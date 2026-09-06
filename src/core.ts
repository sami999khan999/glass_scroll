/**
 * `glass-scroll/core` — the framework-free engine. No React import anywhere in this graph.
 */
export { createGlassScroll } from './core/controller'
export {
  buildCSS,
  defineTheme,
  glassScrollCSS,
  presets,
  resolveTheme,
  themeToVars,
  DEFAULT_DARK_SELECTOR,
  DEFAULT_EXCLUDE,
  DEFAULT_HIDE_NATIVE,
  DEFAULT_LIGHT_SELECTOR,
} from './core/styles'
export type { BuildCSSOptions } from './core/styles'
export { clamp, computeAxis, dragToScroll, thumbOffset, thumbSize } from './core/metrics'
export type { AxisInput, AxisMetrics } from './core/metrics'
export { CLASS } from './core/dom'
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
