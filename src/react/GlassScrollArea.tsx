import * as React from 'react'
import { createGlassScroll } from '../core/controller'
import { CLASS } from '../core/dom'
import { buildCSS, resolveTheme, themeToVars } from '../core/styles'
import type {
  Axis,
  GlassScrollInstance,
  PartClassNames,
  PartialTheme,
  PresetName,
  ScrollToOptions,
  TrackClick,
} from '../core/types'
import { GlassScrollContext } from './context'
import type { PartStyles } from './GlassScroll'
import { Styles } from './Styles'

export interface GlassScrollAreaProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
  /** Element type for the inner scroller. Default `'div'`. */
  as?: React.ElementType
  /** Which overlays to draw. Default `'y'`. */
  axis?: Axis
  preset?: PresetName
  theme?: PartialTheme
  autoHide?: boolean
  hideDelay?: number
  edgeReveal?: number
  minThumbSize?: number
  trackClick?: TrackClick
  /** Flash the bar once on mount so scrollability is discoverable. Default `true`. */
  revealOnMount?: boolean
  /** Inherit preset, theme and timing from a wrapping `<GlassScroll>`. Default `true`. */
  inheritTheme?: boolean
  classNames?: PartClassNames
  styles?: PartStyles
  /** Applied to the outer positioned wrapper. Size the area here. */
  className?: string
  style?: React.CSSProperties
  /** Spread onto the inner scroller (`onScroll`, `id`, `role`, `tabIndex`, ...). */
  scrollerProps?: React.HTMLAttributes<HTMLElement> & Record<`data-${string}`, string>
  scrollerRef?: React.Ref<HTMLElement>
  nonce?: string
  onVisibilityChange?: (visible: boolean) => void
  children?: React.ReactNode
}

export interface GlassScrollAreaHandle extends GlassScrollInstance {
  /** The inner scroll container. */
  readonly scroller: HTMLElement | null
}

const cx = (...names: (string | undefined)[]): string => names.filter(Boolean).join(' ')

/**
 * Wraps content in a scroll container with its own glass overlay. Handles the positioned wrapper,
 * the hidden native bar and keyboard focusability so the consumer does not have to.
 */
export const GlassScrollArea = React.forwardRef<GlassScrollAreaHandle, GlassScrollAreaProps>(
  function GlassScrollArea(
    {
      as: Component = 'div',
      axis = 'y',
      preset,
      theme,
      autoHide,
      hideDelay,
      edgeReveal,
      minThumbSize,
      trackClick,
      revealOnMount = true,
      inheritTheme = true,
      classNames = {},
      styles = {},
      className,
      style,
      scrollerProps = {},
      scrollerRef,
      nonce,
      onVisibilityChange,
      children,
      ...rest
    },
    ref,
  ) {
    const ctx = React.useContext(GlassScrollContext)
    const inherited = inheritTheme ? ctx : null

    const resolvedPreset = preset ?? inherited?.preset ?? 'glass'
    const resolvedTrackClick = trackClick ?? inherited?.options.trackClick ?? 'none'
    const resolvedOptions = {
      autoHide: autoHide ?? inherited?.options.autoHide ?? true,
      hideDelay: hideDelay ?? inherited?.options.hideDelay ?? 1100,
      edgeReveal: edgeReveal ?? inherited?.options.edgeReveal ?? 44,
      minThumbSize: minThumbSize ?? inherited?.options.minThumbSize ?? 44,
    }

    // Without a wrapping <GlassScroll>, the area owns its stylesheet. It never hides the document
    // bar or themes nested scrollbars; that is the root's job.
    const themeKey = JSON.stringify(theme ?? null)
    const css = React.useMemo(
      () => (ctx ? null : buildCSS({ scope: 'document', hideDocument: false, preset: resolvedPreset, theme })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [ctx, resolvedPreset, themeKey],
    )

    // Inline variables: the full preset when this area picks a different one than the root,
    // otherwise only the overrides, so the root's :root variables cascade through.
    const rootStyle = React.useMemo<React.CSSProperties>(() => {
      const differs = inherited ? inherited.preset !== resolvedPreset : false
      const vars = themeToVars(differs ? resolveTheme(resolvedPreset, theme) : (theme ?? {}))
      return { ...vars, ...styles.root }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inherited?.preset, resolvedPreset, themeKey, styles.root])

    const [scroller, setScroller] = React.useState<HTMLElement | null>(null)
    const scrollerElRef = React.useRef<HTMLElement | null>(null)
    const overlayRef = React.useRef<HTMLDivElement>(null)
    const instanceRef = React.useRef<GlassScrollInstance | null>(null)
    const visibilityRef = React.useRef(onVisibilityChange)
    React.useEffect(() => {
      visibilityRef.current = onVisibilityChange
    }, [onVisibilityChange])

    const setScrollerRef = React.useCallback(
      (node: HTMLElement | null) => {
        scrollerElRef.current = node
        setScroller(node)
        if (typeof scrollerRef === 'function') scrollerRef(node)
        else if (scrollerRef) scrollerRef.current = node
      },
      [scrollerRef],
    )

    // Keyed on the scroller *element*, so swapping it rebinds the controller.
    React.useEffect(() => {
      const root = overlayRef.current
      if (!scroller || !root) return
      const instance = createGlassScroll(scroller, {
        root,
        axis,
        ...resolvedOptions,
        trackClick: resolvedTrackClick,
        revealOnMount,
        onVisibilityChange: (v) => visibilityRef.current?.(v),
      })
      instanceRef.current = instance
      return () => {
        instance.destroy()
        instanceRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      scroller,
      axis,
      resolvedOptions.autoHide,
      resolvedOptions.hideDelay,
      resolvedOptions.edgeReveal,
      resolvedOptions.minThumbSize,
      resolvedTrackClick,
      revealOnMount,
    ])

    // Reads through refs so the handle stays valid across re-renders and rebinds.
    React.useImperativeHandle(
      ref,
      () => ({
        get scroller() {
          return scrollerElRef.current
        },
        get root() {
          return instanceRef.current?.root ?? overlayRef.current
        },
        get isOverflowing() {
          return instanceRef.current?.isOverflowing ?? { x: false, y: false }
        },
        update: () => instanceRef.current?.update(),
        reveal: () => instanceRef.current?.reveal(),
        scrollTo: (o: ScrollToOptions) => instanceRef.current?.scrollTo(o),
        setOptions: (o) => instanceRef.current?.setOptions(o),
        destroy: () => instanceRef.current?.destroy(),
      }),
      [],
    )

    const { className: scrollerClassName, tabIndex, ...scrollerRest } = scrollerProps

    return (
      <div {...rest} className={cx(CLASS.area, className)} style={style} data-axis={axis}>
        {css !== null && <Styles css={css} nonce={nonce ?? inherited?.nonce} />}
        <Component
          {...scrollerRest}
          ref={setScrollerRef}
          tabIndex={tabIndex ?? 0}
          className={cx(CLASS.scroller, scrollerClassName)}
        >
          {children}
        </Component>
        <div
          ref={overlayRef}
          className={cx(CLASS.root, CLASS.local, classNames.root)}
          style={rootStyle}
          aria-hidden="true"
          data-axis={axis}
          data-overflow="false"
          data-visible="false"
          data-track-click={resolvedTrackClick}
        >
          <div className={cx(CLASS.track, CLASS.trackY, classNames.track)} style={styles.track}>
            <div className={cx(CLASS.thumb, CLASS.thumbY, classNames.thumb)} style={styles.thumb} />
          </div>
          <div className={cx(CLASS.track, CLASS.trackX, classNames.trackX)} style={styles.trackX}>
            <div className={cx(CLASS.thumb, CLASS.thumbX, classNames.thumbX)} style={styles.thumbX} />
          </div>
        </div>
      </div>
    )
  },
)
