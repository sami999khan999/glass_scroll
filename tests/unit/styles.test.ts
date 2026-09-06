import { describe, expect, it } from 'vitest'
import {
  buildCSS,
  defineTheme,
  glassScrollCSS,
  presets,
  resolveTheme,
  themeToVars,
} from '../../src/core/styles'

describe('themeToVars', () => {
  it('maps keys to --gs-* names and numbers to px', () => {
    expect(themeToVars({ thumbBg: 'red', thumbSize: 8, thumbSizeHover: '0.5rem' })).toEqual({
      '--gs-thumb-bg': 'red',
      '--gs-thumb-size': '8px',
      '--gs-thumb-size-hover': '0.5rem',
    })
  })
  it('keeps zIndex unitless and suffixes dark values', () => {
    expect(themeToVars({ zIndex: 50, dark: { thumbBg: 'white' } })).toEqual({
      '--gs-z-index': '50',
      '--gs-thumb-bg-dark': 'white',
    })
  })
  it('skips undefined values', () => {
    expect(themeToVars({ thumbBg: undefined })).toEqual({})
  })
})

describe('resolveTheme', () => {
  it('layers overrides over the preset, including nested dark', () => {
    const t = resolveTheme('glass', { thumbSize: 10, dark: { thumbBg: 'x' } })
    expect(t.thumbSize).toBe(10)
    expect(t.thumbBgHover).toBe(presets.glass.thumbBgHover)
    expect(t.dark.thumbBg).toBe('x')
    expect(t.dark.thumbBgHover).toBe(presets.glass.dark.thumbBgHover)
  })
  it('defineTheme is an identity with inference', () => {
    const t = defineTheme({ thumbBg: 'red' })
    expect(t).toEqual({ thumbBg: 'red' })
  })
})

describe('buildCSS', () => {
  it('emits every variable on :root and the light/dark mapping', () => {
    const css = buildCSS()
    expect(css).toMatch(/^:root\{--gs-/)
    expect(css).toContain('--gs-thumb-bg:rgba(130, 132, 140, 0.55)')
    expect(css).toContain('--gs-thumb-bg-dark:rgba(205, 207, 217, 0.32)')
    expect(css).toContain('--_gs-thumb-bg:var(--gs-thumb-bg)')
    expect(css).toContain('@media (prefers-color-scheme:dark)')
    expect(css).toContain('--_gs-thumb-bg:var(--gs-thumb-bg-dark)')
    expect(css).toContain(':is(.dark, [data-theme="dark"])')
    expect(css).toContain(':is(.light, [data-theme="light"])')
  })
  it('hides the document scrollbar by default and can keep it', () => {
    expect(buildCSS()).toContain('html{scrollbar-width:none}')
    expect(buildCSS({ hideDocument: false })).not.toContain('html{scrollbar-width:none}')
  })
  it('themes nested native bars only in scope="all"', () => {
    expect(buildCSS({ scope: 'all' })).toContain('::-webkit-scrollbar-thumb{')
    expect(buildCSS({ scope: 'all' })).toContain('scrollbar-width:thin')
    expect(buildCSS({ scope: 'document' })).not.toContain('::-webkit-scrollbar-thumb{')
    expect(buildCSS({ scope: 'document' })).not.toContain('scrollbar-width:thin')
  })
  it('emits both native mechanisms ungated, so each engine self-selects', () => {
    const css = buildCSS()
    // Firefox reports `selector(::-webkit-scrollbar)` as supported while painting nothing from
    // it, so gating on that would leave Firefox with no theming at all.
    expect(css).not.toContain('@supports')
    expect(css).toContain('scrollbar-width:thin;scrollbar-color:')
    expect(css).toContain('::-webkit-scrollbar-thumb{background-color:')
  })
  // `scrollbar-width` and `scrollbar-color` are inherited, so hiding or theming one element
  // silently reaches every descendant unless the leak is stopped explicitly.
  describe('inheritance leaks', () => {
    it('stops the document hide from cascading into nested containers', () => {
      const css = buildCSS({ scope: 'document' })
      expect(css).toContain('html{scrollbar-width:none}')
      expect(css).toContain(':where(*:not(html)){scrollbar-width:auto;scrollbar-color:auto}')
      expect(css.indexOf('html{scrollbar-width:none}')).toBeLessThan(
        css.indexOf(':where(*:not(html)){scrollbar-width:auto'),
      )
    })

    it('resets excluded elements and their descendants', () => {
      const css = buildCSS({ exclude: '.keep' })
      expect(css).toContain(':where(:is(.keep), :is(.keep) *){scrollbar-width:auto;scrollbar-color:auto}')
    })

    it('puts the hide rules after the theme so hideNative wins', () => {
      const css = buildCSS({ scope: 'all', hideNative: '.gone' })
      expect(css.indexOf('scrollbar-width:thin')).toBeLessThan(css.indexOf(':is(.gone){scrollbar-width:none'))
    })
  })

  it('honours exclude and hideNative selectors', () => {
    const css = buildCSS({ exclude: '.keep', hideNative: '.gone' })
    expect(css).toContain(':where(*:not(html):not(:is(.keep)))')
    expect(css).toContain(':is(.gone){scrollbar-width:none')
    expect(css).toContain(':is(.gone)::-webkit-scrollbar{display:none')
  })
  it('omits the :not() clause for an empty exclude', () => {
    expect(buildCSS({ exclude: '' })).toContain(':where(*:not(html))::-webkit-scrollbar{')
  })
  it('forces a colour scheme', () => {
    const dark = buildCSS({ colorScheme: 'dark' })
    expect(dark).not.toContain('@media (prefers-color-scheme:dark)')
    expect(dark).toContain(':root,.gs-root{--_gs-thumb-bg:var(--gs-thumb-bg-dark)')
    const light = buildCSS({ colorScheme: 'light' })
    expect(light).not.toContain('--_gs-thumb-bg:var(--gs-thumb-bg-dark)')
  })
  it('bakes the theme prop into :root', () => {
    expect(buildCSS({ preset: 'solid', theme: { thumbBg: 'hotpink' } })).toContain(
      '--gs-thumb-bg:hotpink',
    )
  })
  it('never transitions the JS-owned properties', () => {
    const css = buildCSS()
    const transitions = css.match(/transition:[^;}]+/g) ?? []
    expect(transitions.length).toBeGreaterThan(0)
    for (const t of transitions) {
      expect(t).not.toMatch(/\btransform\b/)
      // height is animated on the x thumb and width on the y thumb; each is CSS-owned there.
      if (t.includes('width')) expect(t).not.toContain('height')
      if (t.includes('height')) expect(t).not.toContain('width')
    }
  })
  it('includes reduced-motion and forced-colours fallbacks', () => {
    const css = buildCSS()
    expect(css).toContain('@media (prefers-reduced-motion:reduce)')
    expect(css).toContain('@media (forced-colors:active){.gs-root{display:none}}')
  })
  it('the default export equals buildCSS() with no options', () => {
    expect(glassScrollCSS).toBe(buildCSS())
  })
})
