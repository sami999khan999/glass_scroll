import * as React from 'react'
import { createGlassScroll } from '../core/controller'
import { CLASS } from '../core/dom'
import { buildCSS, themeToVars } from '../core/styles'
import type {
  Axis,
  ColorScheme,
  GlassScrollInstance,
  PartClassNames,
  PartialTheme,
  PresetName,
  Scope,
  TrackClick,
} from '../core/types'
import { GlassScrollContext, type GlassScrollContextValue } from './context'
import { setDocumentInstance } from './instances'
import { Styles } from './Styles'

export interface PartStyles {
  root?: React.CSSProperties
  track?: React.CSSProperties
  thumb?: React.CSSProperties
  trackX?: React.CSSProperties
  thumbX?: React.CSSProperties
}

export interface GlassScrollProps {
  /** `'all'` re-themes every nested scrollbar too; `'document'` touches only the page. Default `'all'`. */
  scope?: Scope
  /** Which overlay bars to draw for the document. Default `'both'`. */
  axis?: Axis
  preset?: PresetName
  theme?: PartialTheme
  /** Default `'auto'`: follows `prefers-color-scheme` and `darkSelector`/`lightSelector`. */
  colorScheme?: ColorScheme
  /** Selector that switches to the dark palette. Default `.dark, [data-theme="dark"]`. */
  darkSelector?: string
  /** Selector that forces the light palette even when the OS is dark. Default `.light, [data-theme="light"]`. */
  lightSelector?: string
  autoHide?: boolean
  hideDelay?: number
  edgeReveal?: number
  minThumbSize?: number
  trackClick?: TrackClick
  /** In `scope="all"`, elements matching this keep the browser-default scrollbar. */
  exclude?: string
  /** Elements whose native scrollbar is hidden entirely. */
  hideNative?: string
  /**
   * Elements that set their own design tokens (for example `[data-theme]`). Colours written as
   * `var(--token)` then follow the nearest such element instead of the page root.
   */
  themeScope?: string
  classNames?: PartClassNames
  styles?: PartStyles
  /** Render the stylesheet inline. Set `false` if you import `glass-scroll/styles.css`. Default `true`. */
  injectStyles?: boolean
  /** CSP nonce for the injected `<style>`. */
  nonce?: string
  zIndex?: number
  /** Restores the native page scrollbar without unmounting. */
  disabled?: boolean
  onVisibilityChange?: (visible: boolean) => void
  /**
   * Optional. Wrapping children lets `<GlassScrollArea>`s inside inherit the preset, theme and
   * timing through context. Self-closing use is equally valid.
   */
  children?: React.ReactNode
}

const cx = (...names: (string | undefined)[]): string => names.filter(Boolean).join(' ')

/**
 * Mount once, anywhere in the tree (typically the root layout). Replaces the document scrollbar
 * with a glass overlay and, by default, re-themes every nested scrollbar to match.
 */
export function GlassScroll({
  scope = 'all',
  axis = 'both',
  preset = 'glass',
  theme,
  colorScheme = 'auto',
  darkSelector,
  lightSelector,
  autoHide = true,
  hideDelay = 1100,
  edgeReveal = 44,
  minThumbSize = 44,
  trackClick = 'none',
  exclude,
  hideNative,
  themeScope,
  classNames = {},
  styles = {},
  injectStyles = true,
  nonce,
  zIndex,
  disabled = false,
  onVisibilityChange,
  children,
}: GlassScrollProps): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const instanceRef = React.useRef<GlassScrollInstance | null>(null)
  const visibilityRef = React.useRef(onVisibilityChange)
  React.useEffect(() => {
    visibilityRef.current = onVisibilityChange
  }, [onVisibilityChange])

  const themeKey = JSON.stringify(theme ?? null)
  const css = React.useMemo(
    () =>
      buildCSS({
        scope,
        colorScheme,
        preset,
        theme,
        hideDocument: !disabled,
        ...(exclude !== undefined && { exclude }),
        ...(hideNative !== undefined && { hideNative }),
        ...(themeScope !== undefined && { themeScope }),
        ...(darkSelector !== undefined && { darkSelector }),
        ...(lightSelector !== undefined && { lightSelector }),
      }),
    // theme is compared by value via themeKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      scope,
      colorScheme,
      preset,
      themeKey,
      disabled,
      exclude,
      hideNative,
      themeScope,
      darkSelector,
      lightSelector,
    ],
  )

  const rootStyle = React.useMemo<React.CSSProperties>(() => {
    const vars: Record<string, string> = zIndex !== undefined ? { '--gs-z-index': String(zIndex) } : {}
    return { ...vars, ...styles.root }
  }, [zIndex, styles.root])

  React.useEffect(() => {
    const root = rootRef.current
    if (disabled || !root) return
    const instance = createGlassScroll(window, {
      root,
      axis,
      autoHide,
      hideDelay,
      edgeReveal,
      minThumbSize,
      trackClick,
      revealOnMount: false,
      onVisibilityChange: (v) => visibilityRef.current?.(v),
    })
    instanceRef.current = instance
    setDocumentInstance(instance)
    return () => {
      instance.destroy()
      instanceRef.current = null
      setDocumentInstance(null)
    }
  }, [disabled, axis, autoHide, hideDelay, edgeReveal, minThumbSize, trackClick])

  const contextValue = React.useMemo<GlassScrollContextValue>(
    () => ({
      preset,
      theme: theme ?? {},
      options: { autoHide, hideDelay, edgeReveal, minThumbSize, trackClick },
      nonce,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, themeKey, autoHide, hideDelay, edgeReveal, minThumbSize, trackClick, nonce],
  )

  return (
    <GlassScrollContext.Provider value={contextValue}>
      {injectStyles && <Styles css={css} nonce={nonce} />}
      {children}
      <div
        ref={rootRef}
        className={cx(CLASS.root, classNames.root)}
        style={rootStyle}
        aria-hidden="true"
        data-axis={axis}
        data-overflow="false"
        data-visible="false"
        data-track-click={trackClick}
        data-disabled={disabled ? 'true' : undefined}
      >
        <div className={cx(CLASS.track, CLASS.trackY, classNames.track)} style={styles.track}>
          <div className={cx(CLASS.thumb, CLASS.thumbY, classNames.thumb)} style={styles.thumb} />
        </div>
        <div className={cx(CLASS.track, CLASS.trackX, classNames.trackX)} style={styles.trackX}>
          <div className={cx(CLASS.thumb, CLASS.thumbX, classNames.thumbX)} style={styles.thumbX} />
        </div>
      </div>
    </GlassScrollContext.Provider>
  )
}

/** The theme prop as CSS custom properties, for consumers composing their own inline styles. */
export const themeVars = (theme: PartialTheme): React.CSSProperties => themeToVars(theme)
