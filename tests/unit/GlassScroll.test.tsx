import { render, cleanup } from '@testing-library/react'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { GlassScroll, GlassScrollArea, useGlassScroll } from '../../src/index'
import { subscriberCount } from '../../src/core/registry'
import type { GlassScrollAreaHandle } from '../../src/index'

afterEach(cleanup)

const styleTags = () => document.querySelectorAll('style[data-glass-scroll]')

describe('<GlassScroll />', () => {
  it('server-renders a transparent overlay and the stylesheet, without touching window', () => {
    const html = renderToString(<GlassScroll nonce="abc" />)
    expect(html).toContain('class="gs-root"')
    expect(html).toContain('data-overflow="false"')
    expect(html).toContain('data-visible="false"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('html{scrollbar-width:none}')
    expect(html).toContain('nonce="abc"')
  })

  it('mounts one controller, exposes data attributes, and cleans up', () => {
    const { container, unmount } = render(<GlassScroll />)
    const root = container.querySelector<HTMLElement>('.gs-root')!
    expect(root.dataset.axis).toBe('both')
    expect(root.dataset.trackClick).toBe('none')
    expect(subscriberCount()).toBe(1)
    expect(styleTags().length).toBe(1)
    unmount()
    expect(subscriberCount()).toBe(0)
  })

  it('renders one stylesheet for two identical instances', () => {
    render(
      <>
        <GlassScroll />
        <GlassScroll />
      </>,
    )
    expect(styleTags().length).toBe(1)
  })

  it('scope="document" omits the native theme; disabled keeps the native page bar', () => {
    const { rerender } = render(<GlassScroll scope="document" />)
    const css = () => Array.from(styleTags()).map((s) => s.textContent).join('')
    expect(css()).not.toContain('::-webkit-scrollbar-thumb{')
    expect(css()).toContain('html{scrollbar-width:none}')
    rerender(<GlassScroll scope="document" disabled />)
    expect(css()).not.toContain('html{scrollbar-width:none}')
    expect(subscriberCount()).toBe(0)
  })

  it('applies zIndex and theme through variables', () => {
    const { container } = render(<GlassScroll zIndex={42} theme={{ thumbBg: 'hotpink' }} />)
    const root = container.querySelector<HTMLElement>('.gs-root')!
    expect(root.style.getPropertyValue('--gs-z-index')).toBe('42')
    expect(Array.from(styleTags()).map((s) => s.textContent).join('')).toContain(
      '--gs-thumb-bg:hotpink',
    )
  })

  it('survives Strict Mode double effects with one listener set', () => {
    render(
      <React.StrictMode>
        <GlassScroll />
      </React.StrictMode>,
    )
    expect(subscriberCount()).toBe(1)
  })
})

describe('<GlassScrollArea />', () => {
  it('renders the host contract: positioned wrapper, focusable scroller, local overlay', () => {
    const { container } = render(
      <GlassScrollArea className="pane" scrollerProps={{ id: 'inner' }}>
        <p>content</p>
      </GlassScrollArea>,
    )
    const area = container.querySelector<HTMLElement>('.gs-area')!
    expect(area.classList.contains('pane')).toBe(true)
    const scroller = area.querySelector<HTMLElement>('.gs-scroller')!
    expect(scroller.id).toBe('inner')
    expect(scroller.tabIndex).toBe(0)
    expect(scroller.textContent).toBe('content')
    const overlay = area.querySelector<HTMLElement>('.gs-root--local')!
    expect(overlay.dataset.axis).toBe('y')
    expect(subscriberCount()).toBe(1)
  })

  it('owns a stylesheet when standalone and inherits from a wrapping root', () => {
    const { unmount } = render(<GlassScrollArea>x</GlassScrollArea>)
    expect(styleTags().length).toBe(1)
    expect(Array.from(styleTags())[0]!.textContent).not.toContain('html{scrollbar-width:none}')
    unmount()
    render(
      <GlassScroll preset="solid" hideDelay={200}>
        <GlassScrollArea>x</GlassScrollArea>
      </GlassScroll>,
    )
    expect(styleTags().length).toBe(1)
    expect(Array.from(styleTags())[0]!.textContent).toContain('html{scrollbar-width:none}')
  })

  it('exposes an imperative handle and useGlassScroll proxies to it', () => {
    const holder: { ref: React.RefObject<GlassScrollAreaHandle | null> | null } = { ref: null }
    function Probe() {
      const ref = React.useRef<GlassScrollAreaHandle>(null)
      holder.ref = ref
      const api = useGlassScroll(ref)
      React.useEffect(() => {
        api.update()
        api.reveal()
      }, [api])
      return <GlassScrollArea ref={ref}>x</GlassScrollArea>
    }
    render(<Probe />)
    const handle = holder.ref?.current
    expect(handle).toBeTruthy()
    expect(handle!.scroller?.classList.contains('gs-scroller')).toBe(true)
    expect(handle!.root?.classList.contains('gs-root')).toBe(true)
    expect(handle!.root?.dataset.visible).toBe('true')
  })
})
