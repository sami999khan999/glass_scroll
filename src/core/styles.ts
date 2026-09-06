import type {
  ColorScheme,
  GlassScrollTheme,
  GlassScrollThemeColors,
  PartialTheme,
  PresetName,
  Scope,
} from './types'

/* ------------------------------------------------------------------------------------------------
 * Presets
 * ---------------------------------------------------------------------------------------------- */

const base: Omit<GlassScrollTheme, keyof GlassScrollThemeColors | 'dark'> = {
  thumbSize: 6,
  thumbSizeHover: 8,
  thumbRadius: 9999,
  thumbBlur: 4,
  trackSize: 12,
  edgeOffset: 3,
  zIndex: 9998,
  fadeDuration: '300ms',
  growDuration: '180ms',
  ease: 'ease',
  nativeGutter: 10,
}

export const presets: Record<PresetName, GlassScrollTheme> = {
  glass: {
    ...base,
    thumbBg: 'rgba(130, 132, 140, 0.55)',
    thumbBgHover: 'rgba(130, 132, 140, 0.75)',
    thumbBgActive: 'rgba(130, 132, 140, 0.9)',
    thumbShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.35), 0 1px 3px rgba(0, 0, 0, 0.18)',
    trackBg: 'transparent',
    dark: {
      thumbBg: 'rgba(205, 207, 217, 0.32)',
      thumbBgHover: 'rgba(205, 207, 217, 0.55)',
      thumbBgActive: 'rgba(205, 207, 217, 0.7)',
      thumbShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 1px 3px rgba(0, 0, 0, 0.4)',
      trackBg: 'transparent',
    },
  },
  minimal: {
    ...base,
    thumbSize: 4,
    thumbSizeHover: 6,
    thumbBlur: 0,
    thumbBg: 'rgba(0, 0, 0, 0.28)',
    thumbBgHover: 'rgba(0, 0, 0, 0.45)',
    thumbBgActive: 'rgba(0, 0, 0, 0.6)',
    thumbShadow: 'none',
    trackBg: 'transparent',
    dark: {
      thumbBg: 'rgba(255, 255, 255, 0.24)',
      thumbBgHover: 'rgba(255, 255, 255, 0.4)',
      thumbBgActive: 'rgba(255, 255, 255, 0.55)',
      thumbShadow: 'none',
      trackBg: 'transparent',
    },
  },
  solid: {
    ...base,
    thumbSize: 8,
    thumbSizeHover: 10,
    thumbBlur: 0,
    thumbRadius: 6,
    thumbBg: 'rgb(99, 102, 241)',
    thumbBgHover: 'rgb(79, 82, 221)',
    thumbBgActive: 'rgb(67, 56, 202)',
    thumbShadow: 'none',
    trackBg: 'rgba(0, 0, 0, 0.06)',
    dark: {
      thumbBg: 'rgb(129, 140, 248)',
      thumbBgHover: 'rgb(165, 180, 252)',
      thumbBgActive: 'rgb(199, 210, 254)',
      thumbShadow: 'none',
      trackBg: 'rgba(255, 255, 255, 0.08)',
    },
  },
}

/** Identity helper that gives editor autocompletion for custom themes. */
export const defineTheme = <T extends PartialTheme>(theme: T): T => theme

/** Preset plus per-property overrides, fully resolved. */
export const resolveTheme = (preset: PresetName = 'glass', theme: PartialTheme = {}): GlassScrollTheme => {
  const p = presets[preset]
  const { dark, ...rest } = theme
  return { ...p, ...rest, dark: { ...p.dark, ...dark } }
}

/* ------------------------------------------------------------------------------------------------
 * Variables
 * ---------------------------------------------------------------------------------------------- */

const COLOR_KEYS: readonly (keyof GlassScrollThemeColors)[] = [
  'thumbBg',
  'thumbBgHover',
  'thumbBgActive',
  'thumbShadow',
  'trackBg',
]

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const varName = (key: string, dark = false): string => `--gs-${kebab(key)}${dark ? '-dark' : ''}`

const toCSSValue = (key: string, value: unknown): string => {
  if (typeof value === 'number') return key === 'zIndex' ? String(value) : `${value}px`
  return String(value)
}

/**
 * Converts a (partial) theme into `--gs-*` custom properties. Suitable for an inline `style`
 * object or for serialising into a rule.
 */
export const themeToVars = (theme: PartialTheme): Record<string, string> => {
  const vars: Record<string, string> = {}
  const { dark, ...rest } = theme
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) vars[varName(key)] = toCSSValue(key, value)
  }
  if (dark) {
    for (const [key, value] of Object.entries(dark)) {
      if (value !== undefined) vars[varName(key, true)] = toCSSValue(key, value)
    }
  }
  return vars
}

const serialise = (vars: Record<string, string>): string =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')

/**
 * The stylesheet never reads a `--gs-*` colour directly. It reads a private `--_gs-*` twin that
 * points at either the light or the dark variable. Dark-mode selection therefore lives in the
 * stylesheet, and an inline `--gs-thumb-bg` on a root still respects dark mode.
 */
const mapping = (dark: boolean): string =>
  COLOR_KEYS.map((k) => `--_gs-${kebab(k)}:var(${varName(k, dark)})`).join(';')

/* ------------------------------------------------------------------------------------------------
 * Stylesheet
 * ---------------------------------------------------------------------------------------------- */

export interface BuildCSSOptions {
  scope?: Scope
  /** Elements that keep the browser-default scrollbar in `scope="all"`. */
  exclude?: string
  /** Elements whose native scrollbar is hidden entirely. */
  hideNative?: string
  colorScheme?: ColorScheme
  darkSelector?: string
  lightSelector?: string
  preset?: PresetName
  theme?: PartialTheme
  /** Hide the document's native scrollbar. Default `true`. */
  hideDocument?: boolean
}

export const DEFAULT_EXCLUDE = '.no-glass, [data-glass-scroll="off"]'
export const DEFAULT_HIDE_NATIVE = '.no-scrollbar, [data-glass-scroll="hidden"]'
export const DEFAULT_DARK_SELECTOR = '.dark, [data-theme="dark"]'
export const DEFAULT_LIGHT_SELECTOR = '.light, [data-theme="light"]'

const R = '.gs-root'
const T = '.gs-thumb'
const grow = (size: string, edge: string): string =>
  `${size}:var(--gs-thumb-size-hover);${edge}:calc(var(--gs-edge-offset) - (var(--gs-thumb-size-hover) - var(--gs-thumb-size)) / 2)`
const transition = (size: string, edge: string): string =>
  `transition:${size} var(--gs-grow-duration) var(--gs-ease),${edge} var(--gs-grow-duration) var(--gs-ease),background-color var(--gs-grow-duration) var(--gs-ease),box-shadow var(--gs-grow-duration) var(--gs-ease)`

const overlayCSS = (): string =>
  [
    // Root: an inert, full-size layer. Only the thumb re-enables pointer events.
    `${R}{position:fixed;inset:0;z-index:var(--gs-z-index);pointer-events:none;opacity:0;transition:opacity var(--gs-fade-duration) var(--gs-ease);contain:strict;box-sizing:border-box}`,
    `${R}--local{position:absolute;z-index:30}`,
    `${R}[data-overflow="true"][data-visible="true"]{opacity:1}`,
    `${R}[data-disabled="true"]{display:none}`,
    // Tracks: channels the thumbs run in. They paint nothing unless --gs-track-bg is set.
    `.gs-track{position:absolute;background:var(--_gs-track-bg);box-sizing:border-box}`,
    `.gs-track--y{top:0;right:0;bottom:0;width:var(--gs-track-size)}`,
    `.gs-track--x{left:0;right:0;bottom:0;height:var(--gs-track-size)}`,
    `${R}[data-overflow-x="true"][data-axis="both"] .gs-track--y{bottom:var(--gs-track-size)}`,
    `${R}[data-overflow-y="true"][data-axis="both"] .gs-track--x{right:var(--gs-track-size)}`,
    `${R}[data-overflow-y="false"] .gs-track--y,${R}[data-axis="x"] .gs-track--y{visibility:hidden}`,
    `${R}[data-overflow-x="false"] .gs-track--x,${R}[data-axis="y"] .gs-track--x{visibility:hidden}`,
    `${R}[data-track-click="page"][data-visible="true"] .gs-track,${R}[data-track-click="jump"][data-visible="true"] .gs-track{pointer-events:auto}`,
    // Thumb: JS owns transform and the along-axis size; CSS owns everything else.
    `${T}{position:absolute;border-radius:var(--gs-thumb-radius);background:var(--_gs-thumb-bg);box-shadow:var(--_gs-thumb-shadow);-webkit-backdrop-filter:blur(var(--gs-thumb-blur));backdrop-filter:blur(var(--gs-thumb-blur));pointer-events:auto;cursor:grab;will-change:transform;touch-action:none;box-sizing:border-box}`,
    `${T}::before,${T}::after{content:none!important}`,
    `${T}--y{top:0;right:var(--gs-edge-offset);width:var(--gs-thumb-size);${transition('width', 'right')}}`,
    `${T}--x{left:0;bottom:var(--gs-edge-offset);height:var(--gs-thumb-size);${transition('height', 'bottom')}}`,
    `${T}:hover{background:var(--_gs-thumb-bg-hover)}`,
    `${T}--y:hover,${R}[data-dragging="y"] ${T}--y{${grow('width', 'right')}}`,
    `${T}--x:hover,${R}[data-dragging="x"] ${T}--x{${grow('height', 'bottom')}}`,
    `${R}[data-dragging] ${T}{cursor:grabbing}`,
    `${R}[data-dragging="y"] ${T}--y,${R}[data-dragging="x"] ${T}--x{background:var(--_gs-thumb-bg-active)}`,
    // Scroll area: positioned wrapper + scroller with its native bar hidden.
    `.gs-area{position:relative;display:flex;flex-direction:column;overflow:hidden;min-height:0;min-width:0}`,
    `.gs-scroller{flex:1 1 auto;min-height:0;min-width:0;overflow:auto;scrollbar-width:none;-ms-overflow-style:none}`,
    `.gs-scroller::-webkit-scrollbar{display:none;width:0;height:0}`,
    `.gs-area[data-axis="y"] .gs-scroller{overflow-x:hidden}`,
    `.gs-area[data-axis="x"] .gs-scroller{overflow-y:hidden}`,
    // Motion and contrast preferences.
    `@media (prefers-reduced-motion:reduce){${R},${T}{transition:none}}`,
    `@media (forced-colors:active){${R}{display:none}}`,
  ].join('\n')

/**
 * Hides the document's own scrollbar, which is what removes the layout gutter.
 *
 * `scrollbar-width` and `scrollbar-color` are **inherited** properties, so setting them on `html`
 * would otherwise cascade `none` into every nested scroll container and silently hide their
 * scrollbars too. The second rule stops that leak by restoring the initial value on everything
 * below the root; `scope="all"`'s theme is emitted after this and overrides it in turn.
 */
const documentHideCSS = (): string =>
  [
    `html{scrollbar-width:none}`,
    `:where(*:not(html)){scrollbar-width:auto;scrollbar-color:auto}`,
    `html::-webkit-scrollbar{display:none;width:0;height:0}`,
    `@media (forced-colors:active){html{scrollbar-width:auto}html::-webkit-scrollbar{display:block;width:auto;height:auto}}`,
  ].join('\n')

const hideNativeCSS = (selector: string): string =>
  [
    `:is(${selector}){scrollbar-width:none;-ms-overflow-style:none}`,
    `:is(${selector})::-webkit-scrollbar{display:none;width:0;height:0}`,
  ].join('\n')

/**
 * Themed native scrollbars for every nested container.
 *
 * Both mechanisms are emitted unconditionally and each engine selects one on its own. An engine
 * that does not know `scrollbar-color` drops that declaration and paints the
 * `::-webkit-scrollbar` pseudo-elements (older Safari and Chromium); an engine that does know it
 * uses the standard properties and — by Chromium's own rule that a non-`auto` `scrollbar-width`
 * or `scrollbar-color` disables custom `::-webkit-scrollbar` painting — ignores the
 * pseudo-elements (Firefox, Chromium 121+, Safari 18.2+).
 *
 * The pseudo-element path reserves a 10px gutter but paints a 6px pill inside it, via a 2px
 * transparent border plus `background-clip: padding-box`, matching the overlay thumb exactly.
 * The standard path is a thin two-tone bar drawn from the same colours; it cannot carry the blur
 * or the hairline, which is a limit of the platform API rather than a choice.
 *
 * Do NOT gate these on `@supports selector(::-webkit-scrollbar)`: Firefox parses that selector
 * and reports it as supported while painting nothing from it, which would leave Firefox unthemed.
 *
 * `:where()` keeps specificity at zero so any author rule wins.
 */
const nativeThemeCSS = (exclude: string): string => {
  const trimmed = exclude.trim()
  const sel = `:where(*:not(html)${trimmed ? `:not(:is(${exclude}))` : ''})`
  return [
    `${sel}{scrollbar-width:thin;scrollbar-color:var(--_gs-thumb-bg) var(--_gs-track-bg)}`,
    // Leaving an element out of the themed selector is not enough: both properties are
    // inherited, so an excluded element would still pick the theme up from its ancestors.
    // Reset it explicitly, and its own descendants with it.
    ...(trimmed ? [`:where(:is(${exclude}), :is(${exclude}) *){scrollbar-width:auto;scrollbar-color:auto}`] : []),
    `${sel}::-webkit-scrollbar{width:var(--gs-native-gutter);height:var(--gs-native-gutter);background:transparent}`,
    `${sel}::-webkit-scrollbar-track{background:var(--_gs-track-bg)}`,
    `${sel}::-webkit-scrollbar-corner{background:transparent}`,
    `${sel}::-webkit-scrollbar-thumb{background-color:var(--_gs-thumb-bg);border:2px solid transparent;border-radius:var(--gs-thumb-radius);background-clip:padding-box;box-shadow:var(--_gs-thumb-shadow);-webkit-backdrop-filter:blur(var(--gs-thumb-blur));backdrop-filter:blur(var(--gs-thumb-blur))}`,
    `${sel}::-webkit-scrollbar-thumb:hover{background-color:var(--_gs-thumb-bg-hover)}`,
    `${sel}::-webkit-scrollbar-thumb:active{background-color:var(--_gs-thumb-bg-active)}`,
  ].join('\n')
}

/** The complete stylesheet for one configuration. */
export const buildCSS = (options: BuildCSSOptions = {}): string => {
  const {
    scope = 'all',
    exclude = DEFAULT_EXCLUDE,
    hideNative = DEFAULT_HIDE_NATIVE,
    colorScheme = 'auto',
    darkSelector = DEFAULT_DARK_SELECTOR,
    lightSelector = DEFAULT_LIGHT_SELECTOR,
    preset = 'glass',
    theme = {},
    hideDocument = true,
  } = options

  const resolved = resolveTheme(preset, theme)
  const vars = serialise(themeToVars(resolved))

  const parts: string[] = []
  // Variables live on :root so nested native bars and every overlay inherit them; the light/dark
  // mapping is re-declared on .gs-root so an inline override on a root still resolves locally.
  parts.push(`:root{${vars};${mapping(false)}}`)
  parts.push(`${R}{${mapping(false)}}`)
  if (colorScheme === 'dark') {
    parts.push(`:root,${R}{${mapping(true)}}`)
  } else if (colorScheme === 'auto') {
    parts.push(`@media (prefers-color-scheme:dark){:root,${R}{${mapping(true)}}}`)
    if (darkSelector.trim()) parts.push(`:is(${darkSelector}),:is(${darkSelector}) ${R}{${mapping(true)}}`)
    if (lightSelector.trim())
      parts.push(`:is(${lightSelector}),:is(${lightSelector}) ${R}{${mapping(false)}}`)
  }

  parts.push(overlayCSS())
  if (hideDocument) parts.push(documentHideCSS())
  if (scope === 'all') parts.push(nativeThemeCSS(exclude))
  // Emitted last, and deliberately after the theme: every one of these rules is zero-specificity
  // `:where()`, so source order decides, and an explicit request to hide a scrollbar must beat
  // the blanket theme that would otherwise re-style the very element being hidden.
  if (hideNative.trim()) parts.push(hideNativeCSS(hideNative))

  return parts.join('\n')
}

/** The default stylesheet, also emitted to `glass-scroll/styles.css` at build time. */
export const glassScrollCSS: string = buildCSS()
