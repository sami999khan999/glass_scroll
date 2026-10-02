import { expect, test } from '@playwright/test'

const docRoot = '.gs-root:not(.gs-root--local)'
const docThumb = `${docRoot} .gs-thumb--y`

type Page = import('@playwright/test').Page

/**
 * Waits until the controller has mounted and measured. `data-overflow` is written by the first
 * `update()`, which only runs from the hydration effect, so this is the signal that the scroll
 * listener is attached — scrolling before it is a lost event, not a missed reveal.
 */
const waitForOverlay = async (page: Page) => {
  await expect(page.locator(docRoot)).toHaveAttribute('data-overflow', 'true')
}

/**
 * Scrolls the page and waits for the resulting scroll event to be handled. `mouse.wheel` is not
 * honoured reliably by WebKit's driver, so drive the scroller directly; the code path under test
 * (scroll event -> reveal -> rAF update) is identical either way.
 */
const scrollPage = async (page: Page, top: number) => {
  await waitForOverlay(page)
  await page.evaluate((y) => {
    window.scrollTo({ top: y, behavior: 'instant' })
  }, top)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(null)
        })
      }),
  )
}

test.describe('document overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('the page reserves no scrollbar gutter', async ({ page }) => {
    // The whole point of the overlay: the viewport width is the full window width.
    const { inner, client } = await page.evaluate(() => ({
      inner: window.innerWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(client).toBe(inner)
  })

  test('the thumb is proportional and reaches the track bottom', async ({ page }) => {
    await scrollPage(page, 200)
    await expect(page.locator(docRoot)).toHaveAttribute('data-overflow', 'true')

    const proportional = await page.evaluate(() => {
      const thumb = document.querySelector<HTMLElement>('.gs-root:not(.gs-root--local) .gs-thumb--y')!
      const track = thumb.parentElement!
      const doc = document.documentElement
      const expected = Math.max(44, (doc.clientHeight / doc.scrollHeight) * track.clientHeight)
      return { actual: thumb.getBoundingClientRect().height, expected }
    })
    expect(proportional.actual).toBeCloseTo(proportional.expected, 0)

    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
    })
    await page.waitForTimeout(100)

    const aligned = await page.evaluate(() => {
      const thumb = document.querySelector<HTMLElement>('.gs-root:not(.gs-root--local) .gs-thumb--y')!
      const track = thumb.parentElement!
      return {
        thumbBottom: thumb.getBoundingClientRect().bottom,
        trackBottom: track.getBoundingClientRect().bottom,
      }
    })
    expect(aligned.thumbBottom).toBeCloseTo(aligned.trackBottom, 0)
  })

  test('scrolling reveals the bar and it fades again', async ({ page }) => {
    await waitForOverlay(page)
    await expect(page.locator(docRoot)).toHaveAttribute('data-visible', 'false')
    await scrollPage(page, 300)
    await expect(page.locator(docRoot)).toHaveAttribute('data-visible', 'true')
    await expect(page.locator(docRoot)).toHaveAttribute('data-visible', 'false', { timeout: 4000 })
  })

  test('dragging the thumb scrolls the page', async ({ page }) => {
    await scrollPage(page, 100)
    await expect(page.locator(docRoot)).toHaveAttribute('data-visible', 'true')
    const before = await page.evaluate(() => window.scrollY)

    const box = (await page.locator(docThumb).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect(page.locator(docRoot)).toHaveAttribute('data-dragging', 'y')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 8 })
    const during = await page.evaluate(() => window.scrollY)
    expect(during).toBeGreaterThan(before + 100)
    await page.mouse.up()
    await expect(page.locator(docRoot)).not.toHaveAttribute('data-dragging', 'y')
  })

  test('the overlay never intercepts clicks on content beneath it', async ({ page }) => {
    const className = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth - 4, window.innerHeight / 2)
      return el instanceof HTMLElement ? el.className : ''
    })
    expect(className).not.toContain('gs-root')
  })

  test('server-rendered HTML already contains the hidden overlay and its styles', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text()
    expect(html).toContain('class="gs-root"')
    expect(html).toContain('data-overflow="false"')
    expect(html).toContain('html{scrollbar-width:none}')
  })
})

test.describe('scroll areas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('a wrapped area gets its own overlay, pinned to the area', async ({ page }) => {
    const area = page.getByTestId('area')
    const overlay = area.locator('.gs-root--local')
    await expect(overlay).toHaveAttribute('data-overflow', 'true')

    const areaBox = (await area.boundingBox())!
    const overlayBox = (await overlay.boundingBox())!
    // Within a pixel: the area has a 1px border the overlay sits inside of.
    expect(Math.abs(overlayBox.x + overlayBox.width - (areaBox.x + areaBox.width))).toBeLessThan(2)
    expect(Math.abs(overlayBox.y - areaBox.y)).toBeLessThan(2)
  })

  test('the area scroller stays keyboard-scrollable', async ({ page }) => {
    const scroller = page.getByTestId('area').locator('.gs-scroller')
    await scroller.focus()
    await page.keyboard.press('PageDown')
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  })

  test('a horizontal area draws the x thumb only', async ({ page }) => {
    const strip = page.getByTestId('strip')
    await expect(strip.locator('.gs-root--local')).toHaveAttribute('data-overflow-x', 'true')
    await expect(strip.locator('.gs-root--local')).toHaveAttribute('data-axis', 'x')
  })
})

test.describe('nested scrollbars', () => {
  test('a plain container is themed, and an excluded one keeps the browser default', async ({
    page,
  }) => {
    await page.goto('/')

    // The stylesheet emits both mechanisms and the engine picks one: the standard properties
    // where `scrollbar-color` is understood, the WebKit pseudo-elements otherwise. Assert
    // whichever one this engine actually took, and that the excluded element took neither.
    const standard = await page.evaluate(() => CSS.supports('scrollbar-color: red blue'))

    if (standard) {
      // Firefox does not report a queryable computed value for `scrollbar-width` (even an inline
      // declaration reads back as the root's value), so check the property is readable at all
      // before trusting it. The rules themselves are covered by the unit suite either way.
      const readable = await page.evaluate(() => {
        const probe = document.createElement('div')
        probe.style.scrollbarWidth = 'thin'
        document.body.appendChild(probe)
        const ok = getComputedStyle(probe).scrollbarWidth === 'thin'
        probe.remove()
        return ok
      })
      test.skip(!readable, 'scrollbar-width is not queryable in this engine')

      const read = (id: string) =>
        page.getByTestId(id).evaluate((el) => ({
          width: getComputedStyle(el).scrollbarWidth,
          color: getComputedStyle(el).scrollbarColor,
        }))
      const themed = await read('native')
      const excluded = await read('excluded')
      expect(themed.width).toBe('thin')
      expect(themed.color).toContain('rgba(130, 132, 140, 0.55)')
      // The excluded element must not inherit the theme from its ancestors.
      expect(excluded.width).toBe('auto')
      expect(excluded.color).toBe('auto')
    } else {
      // Read the scrollbar pseudo-element itself: the themed rule sets its width to
      // --gs-native-gutter and paints the thumb; the excluded one keeps the browser default.
      const styles = await page.evaluate(() => {
        const read = (id: string) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
          return {
            bar: getComputedStyle(el, '::-webkit-scrollbar').width,
            thumb: getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor,
          }
        }
        return { themed: read('native'), excluded: read('excluded') }
      })
      expect(styles.themed.bar).toBe('10px')
      expect(styles.themed.thumb).toBe('rgba(130, 132, 140, 0.55)')
      expect(styles.excluded.bar).not.toBe('10px')
    }
  })
})

test.describe('preferences', () => {
  test('reduced motion removes the fade transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const transition = await page
      .locator(docRoot)
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(transition).toBe('0s')
  })

  test('the dark palette applies when the html element carries .dark', async ({ page }) => {
    await page.goto('/')
    const before = await page.locator(docThumb).evaluate((el) => getComputedStyle(el).backgroundColor)
    await page.getByTestId('theme-toggle').click()
    await expect.poll(() =>
      page.locator(docThumb).evaluate((el) => getComputedStyle(el).backgroundColor),
    ).not.toBe(before)
  })
})
