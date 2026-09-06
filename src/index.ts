/**
 * `glass-scroll` — React entry.
 */
export { GlassScroll, themeVars } from './react/GlassScroll'
export type { GlassScrollProps, PartStyles } from './react/GlassScroll'
export { GlassScrollArea } from './react/GlassScrollArea'
export type { GlassScrollAreaProps, GlassScrollAreaHandle } from './react/GlassScrollArea'
export { useGlassScroll } from './react/useGlassScroll'
export type { GlassScrollHandle } from './react/useGlassScroll'
export { GlassScrollContext } from './react/context'
export type { GlassScrollContextValue } from './react/context'

// Core re-exports, so one import covers the common cases.
export { createGlassScroll } from './core/controller'
export {
  buildCSS,
  defineTheme,
  glassScrollCSS,
  presets,
  resolveTheme,
  themeToVars,
} from './core/styles'
export type { BuildCSSOptions } from './core/styles'
export type {
  Axis,
  ColorScheme,
  GlassScrollInstance,
  GlassScrollOptions,
  GlassScrollTheme,
  GlassScrollThemeColors,
  Length,
  PartClassNames,
  PartialTheme,
  PresetName,
  Scope,
  ScrollTarget,
  ScrollToOptions,
  SingleAxis,
  TrackClick,
} from './core/types'
