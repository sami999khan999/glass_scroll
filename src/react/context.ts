import { createContext } from 'react'
import type { GlassScrollOptions, PartialTheme, PresetName } from '../core/types'

export type SharedOptions = Pick<
  GlassScrollOptions,
  'autoHide' | 'hideDelay' | 'edgeReveal' | 'minThumbSize' | 'trackClick'
>

export interface GlassScrollContextValue {
  preset: PresetName
  theme: PartialTheme
  options: SharedOptions
  nonce: string | undefined
}

/**
 * Provided by `<GlassScroll>` when it wraps children. Areas inside inherit the preset, theme and
 * timing, and skip rendering their own stylesheet.
 */
export const GlassScrollContext = createContext<GlassScrollContextValue | null>(null)
