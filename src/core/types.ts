export type Axis = 'x' | 'y' | 'both'
export type SingleAxis = 'x' | 'y'
export type Scope = 'all' | 'document'
export type ColorScheme = 'auto' | 'light' | 'dark'
export type TrackClick = 'none' | 'page' | 'jump'
export type PresetName = 'glass' | 'minimal' | 'solid'

/** Anything the overlay can mirror: the page (`window`) or a scrollable element. */
export type ScrollTarget = Window | HTMLElement

/** A CSS length. Numbers are treated as pixels. */
export type Length = number | string

/** The colour and shadow values, which have a dark-mode twin. */
export interface GlassScrollThemeColors {
  /** Resting thumb fill. */
  thumbBg: string
  /** Thumb fill while hovered. */
  thumbBgHover: string
  /** Thumb fill while dragging. */
  thumbBgActive: string
  /** Thumb box-shadow. Use a hairline inset for the glass edge. */
  thumbShadow: string
  /** Track background. `transparent` keeps the track invisible. */
  trackBg: string
}

export interface GlassScrollTheme extends GlassScrollThemeColors {
  /** Thumb thickness. */
  thumbSize: Length
  /** Thumb thickness while hovered or dragging. Growth happens toward the content. */
  thumbSizeHover: Length
  thumbRadius: Length
  /** `backdrop-filter: blur()` amount. `0` disables the filter. */
  thumbBlur: Length
  /** Width of the inert strip the thumb runs in. */
  trackSize: Length
  /** Gap between the thumb and the scroller edge. */
  edgeOffset: Length
  zIndex: number
  /** Fade in/out duration. */
  fadeDuration: string
  /** Hover growth duration. */
  growDuration: string
  ease: string
  /** Gutter reserved by CSS-themed native scrollbars (scope="all"). */
  nativeGutter: Length
  /** Dark-mode overrides for the colour values. */
  dark: Partial<GlassScrollThemeColors>
}

export type PartialTheme = Partial<Omit<GlassScrollTheme, 'dark'>> & {
  dark?: Partial<GlassScrollThemeColors>
}

export interface PartClassNames {
  root?: string
  track?: string
  thumb?: string
  trackX?: string
  thumbX?: string
}

/** Options accepted by the framework-free `createGlassScroll`. */
export interface GlassScrollOptions {
  /** Which overlay bars to draw. Default `'both'` for the window, `'y'` for elements. */
  axis?: Axis
  /** Fade out after `hideDelay` ms of inactivity. Default `true`. */
  autoHide?: boolean
  /** Milliseconds of quiet before fading. Default `1100`. */
  hideDelay?: number
  /** Pointer distance (px) from the scroller edge that reveals the bar. `0` disables. Default `44`. */
  edgeReveal?: number
  /** Minimum thumb length in px. Default `44`. */
  minThumbSize?: number
  /** Track click behaviour. Default `'none'`. */
  trackClick?: TrackClick
  /** Flash the bar once on mount. Default `true` for elements, `false` for the window. */
  revealOnMount?: boolean
  onVisibilityChange?: (visible: boolean) => void
  /**
   * An existing overlay root (for example one rendered by React during SSR). When omitted the
   * root is created and appended to `container`.
   */
  root?: HTMLElement
  /** Where to append a created root. Defaults to `document.body` for the window, else the target's parent. */
  container?: HTMLElement
  classNames?: PartClassNames
}

export interface ScrollToOptions {
  top?: number
  left?: number
  behavior?: ScrollBehavior
}

export interface GlassScrollInstance {
  /** Re-measure and redraw now (synchronously). */
  update: () => void
  /** Show the bar and arm the auto-hide timer. */
  reveal: () => void
  scrollTo: (options: ScrollToOptions) => void
  setOptions: (options: Partial<GlassScrollOptions>) => void
  destroy: () => void
  /** The overlay root element, or `null` for the inert SSR instance. */
  readonly root: HTMLElement | null
  readonly isOverflowing: Readonly<Record<SingleAxis, boolean>>
}
