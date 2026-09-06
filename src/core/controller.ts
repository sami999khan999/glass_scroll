import { axes, createOverlay, setData } from './dom'
import { clamp, computeAxis, dragToScroll, type AxisMetrics } from './metrics'
import { observeContent } from './observers'
import { subscribe } from './registry'
import type {
  GlassScrollInstance,
  GlassScrollOptions,
  ScrollTarget,
  ScrollToOptions,
  SingleAxis,
} from './types'

const EMPTY: AxisMetrics = { overflow: false, maxScroll: 0, thumb: 0, travel: 0, offset: 0 }

// Duck-typed rather than `instanceof Window`: the target can come from another realm (an iframe,
// or a test environment whose `Window` global is not the one that created `window`), where
// `instanceof` is false for a genuine window. Only nodes have a numeric `nodeType`.
const isWindow = (t: ScrollTarget): t is Window => typeof (t as Node).nodeType !== 'number'

const noop = (): void => undefined

const inert = (root: HTMLElement | null): GlassScrollInstance => ({
  update: noop,
  reveal: noop,
  scrollTo: noop,
  setOptions: noop,
  destroy: noop,
  root,
  isOverflowing: { x: false, y: false },
})

interface Resolved {
  axis: NonNullable<GlassScrollOptions['axis']>
  autoHide: boolean
  hideDelay: number
  edgeReveal: number
  minThumbSize: number
  trackClick: NonNullable<GlassScrollOptions['trackClick']>
  revealOnMount: boolean
  onVisibilityChange: GlassScrollOptions['onVisibilityChange']
}

const resolve = (o: GlassScrollOptions, win: boolean): Resolved => ({
  axis: o.axis ?? (win ? 'both' : 'y'),
  autoHide: o.autoHide ?? true,
  hideDelay: o.hideDelay ?? 1100,
  edgeReveal: o.edgeReveal ?? 44,
  minThumbSize: o.minThumbSize ?? 44,
  trackClick: o.trackClick ?? 'none',
  revealOnMount: o.revealOnMount ?? !win,
  onVisibilityChange: o.onVisibilityChange,
})

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** The window/element difference, resolved once. */
interface Scroller {
  events: EventTarget
  scrollPos: () => Record<SingleAxis, number>
  viewport: () => Record<SingleAxis, number>
  content: () => Record<SingleAxis, number>
  scrollTo: (options: globalThis.ScrollToOptions) => void
  bounds: () => Bounds
}

const documentScroller = (): Scroller => {
  const docEl = document.documentElement
  return {
    events: window,
    scrollPos: () => ({ x: window.scrollX, y: window.scrollY }),
    viewport: () => ({ x: docEl.clientWidth, y: docEl.clientHeight }),
    content: () => ({ x: docEl.scrollWidth, y: docEl.scrollHeight }),
    scrollTo: (o) => {
      window.scrollTo(o)
    },
    bounds: () => ({ left: 0, top: 0, right: docEl.clientWidth, bottom: docEl.clientHeight }),
  }
}

const elementScroller = (el: HTMLElement): Scroller => ({
  events: el,
  scrollPos: () => ({ x: el.scrollLeft, y: el.scrollTop }),
  viewport: () => ({ x: el.clientWidth, y: el.clientHeight }),
  content: () => ({ x: el.scrollWidth, y: el.scrollHeight }),
  scrollTo: (o) => {
    el.scrollTo(o)
  },
  bounds: () => el.getBoundingClientRect(),
})

/**
 * Creates an overlay scrollbar that mirrors `target` (the window or a scrollable element).
 * Framework-free. Everything the React layer does is a thin wrapper over this.
 *
 * Returns an inert instance when there is no DOM, so it is safe to call during SSR.
 */
export function createGlassScroll(
  target: ScrollTarget,
  options: GlassScrollOptions = {},
): GlassScrollInstance {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return inert(options.root ?? null)
  }

  const win = isWindow(target)
  const el: HTMLElement | null = win ? null : target
  let raw: GlassScrollOptions = { ...options }
  let opts = resolve(raw, win)

  // One adapter resolves the window/element difference once, so nothing below branches on it.
  const scroller = el ? elementScroller(el) : documentScroller()

  const parts = createOverlay(options.root, opts.axis, !win, options.classNames)
  const { root, track, thumb } = parts
  if (!parts.external) {
    const container = options.container ?? el?.parentElement ?? document.body
    container.appendChild(root)
  }
  setData(root, 'trackClick', opts.trackClick)

  /* ---- state --------------------------------------------------------------------------------- */
  const overflowing: Record<SingleAxis, boolean> = { x: false, y: false }
  let frame = 0
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let hovering = false
  let dragging: SingleAxis | null = null
  let visible = false
  let destroyed = false
  let endDrag: (() => void) | null = null

  /* ---- measurement --------------------------------------------------------------------------- */
  const { scrollPos, viewport, content } = scroller

  /** All layout reads, batched, before any write. */
  const read = (): Record<SingleAxis, AxisMetrics> => {
    const active = axes(opts.axis)
    const pos = scrollPos()
    const vp = viewport()
    const ct = content()
    const minThumb = opts.minThumbSize
    const y = active.includes('y')
      ? computeAxis({ viewport: vp.y, content: ct.y, track: track.y.clientHeight, scroll: pos.y, minThumb })
      : EMPTY
    const x = active.includes('x')
      ? computeAxis({ viewport: vp.x, content: ct.x, track: track.x.clientWidth, scroll: pos.x, minThumb })
      : EMPTY
    return { x, y }
  }

  const write = (m: Record<SingleAxis, AxisMetrics>): void => {
    const changed = overflowing.x !== m.x.overflow || overflowing.y !== m.y.overflow
    overflowing.x = m.x.overflow
    overflowing.y = m.y.overflow
    setData(root, 'overflow', String(m.x.overflow || m.y.overflow))
    setData(root, 'overflowX', String(m.x.overflow))
    setData(root, 'overflowY', String(m.y.overflow))
    if (m.y.overflow) {
      thumb.y.style.height = `${m.y.thumb}px`
      thumb.y.style.transform = `translate3d(0,${m.y.offset}px,0)`
    }
    if (m.x.overflow) {
      thumb.x.style.width = `${m.x.thumb}px`
      thumb.x.style.transform = `translate3d(${m.x.offset}px,0,0)`
    }
    // The corner inset changes track length when the other axis appears or disappears, so
    // measure once more on the next frame.
    if (changed) schedule()
  }

  const update = (): void => {
    if (destroyed) return
    write(read())
  }

  /** Coalesces any number of triggers into one update per painted frame. */
  const schedule = (): void => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  /* ---- visibility ---------------------------------------------------------------------------- */
  const setVisible = (next: boolean): void => {
    if (visible === next) return
    visible = next
    setData(root, 'visible', String(next))
    opts.onVisibilityChange?.(next)
  }

  const clearHide = (): void => {
    if (hideTimer === undefined) return
    clearTimeout(hideTimer)
    hideTimer = undefined
  }

  const scheduleHide = (): void => {
    clearHide()
    if (!opts.autoHide || hovering || dragging) return
    hideTimer = setTimeout(() => {
      hideTimer = undefined
      setVisible(false)
    }, opts.hideDelay)
  }

  const reveal = (): void => {
    setVisible(true)
    scheduleHide()
  }

  /* ---- scrolling ----------------------------------------------------------------------------- */
  const scrollTo = ({ top, left, behavior = 'instant' }: ScrollToOptions): void => {
    const o: globalThis.ScrollToOptions = { behavior }
    if (top !== undefined) o.top = top
    if (left !== undefined) o.left = left
    scroller.scrollTo(o)
  }

  const onScroll = (): void => {
    schedule()
    reveal()
  }

  /* ---- edge reveal --------------------------------------------------------------------------- */
  const onPointerMove = (e: PointerEvent): void => {
    if (dragging || opts.edgeReveal <= 0 || e.pointerType === 'touch') return
    if (!overflowing.x && !overflowing.y) return
    const r = scroller.bounds()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
    const nearY = overflowing.y && r.right - e.clientX <= opts.edgeReveal
    const nearX = overflowing.x && r.bottom - e.clientY <= opts.edgeReveal
    if (nearY || nearX) reveal()
  }

  /* ---- thumb hover and drag ------------------------------------------------------------------ */
  const onEnter = (): void => {
    hovering = true
    clearHide()
    setVisible(true)
    setData(root, 'hovering', 'true')
  }

  const onLeave = (): void => {
    hovering = false
    setData(root, 'hovering', null)
    scheduleHide()
  }

  const startDrag = (axis: SingleAxis) => (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const m = read()[axis]
    if (!m.overflow) return
    e.preventDefault()
    endDrag?.()

    const th = thumb[axis]
    const startPointer = axis === 'y' ? e.clientY : e.clientX
    const startScroll = scrollPos()[axis]
    const { travel, maxScroll } = m

    dragging = axis
    setData(root, 'dragging', axis)
    clearHide()
    setVisible(true)
    try {
      th.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort */
    }

    const move = (ev: PointerEvent): void => {
      const delta = (axis === 'y' ? ev.clientY : ev.clientX) - startPointer
      const next = dragToScroll(delta, travel, maxScroll, startScroll)
      scrollTo(axis === 'y' ? { top: next } : { left: next })
      // Move the thumb in this same event so it never trails the pointer.
      const offset = (next / maxScroll) * travel
      th.style.transform = axis === 'y' ? `translate3d(0,${offset}px,0)` : `translate3d(${offset}px,0,0)`
    }

    const end = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      try {
        th.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      endDrag = null
      dragging = null
      setData(root, 'dragging', null)
      scheduleHide()
    }

    endDrag = end
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  /* ---- track click --------------------------------------------------------------------------- */
  const onTrackDown = (axis: SingleAxis) => (e: PointerEvent): void => {
    if (opts.trackClick === 'none' || e.target !== track[axis]) return
    const m = read()[axis]
    if (!m.overflow) return
    e.preventDefault()
    const rect = track[axis].getBoundingClientRect()
    const pointer = axis === 'y' ? e.clientY - rect.top : e.clientX - rect.left
    const current = scrollPos()[axis]
    let next: number
    if (opts.trackClick === 'page') {
      const direction = pointer > m.offset ? 1 : -1
      next = current + direction * viewport()[axis]
    } else {
      next = ((pointer - m.thumb / 2) / m.travel) * m.maxScroll
    }
    next = clamp(next, 0, m.maxScroll)
    scrollTo(axis === 'y' ? { top: next, behavior: 'smooth' } : { left: next, behavior: 'smooth' })
    reveal()
  }

  /* ---- wiring -------------------------------------------------------------------------------- */
  scroller.events.addEventListener('scroll', onScroll, { passive: true })
  const unsubscribe = subscribe({ onPointerMove, onResize: schedule })
  const unobserve = observeContent(el, schedule)

  const handlers: [SingleAxis, (e: PointerEvent) => void, (e: PointerEvent) => void][] = (
    ['y', 'x'] as const
  ).map((axis) => [axis, startDrag(axis), onTrackDown(axis)])
  for (const [axis, drag, trackDown] of handlers) {
    thumb[axis].addEventListener('pointerenter', onEnter)
    thumb[axis].addEventListener('pointerleave', onLeave)
    thumb[axis].addEventListener('pointerdown', drag)
    track[axis].addEventListener('pointerdown', trackDown)
  }

  update()
  if (!opts.autoHide) setVisible(true)
  else if (opts.revealOnMount) reveal()

  /* ---- public -------------------------------------------------------------------------------- */
  const setOptions = (next: Partial<GlassScrollOptions>): void => {
    raw = { ...raw, ...next }
    opts = resolve(raw, win)
    setData(root, 'axis', opts.axis)
    setData(root, 'trackClick', opts.trackClick)
    if (!opts.autoHide) {
      clearHide()
      setVisible(true)
    } else {
      scheduleHide()
    }
    update()
  }

  const destroy = (): void => {
    if (destroyed) return
    destroyed = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    clearHide()
    endDrag?.()
    unsubscribe()
    unobserve()
    scroller.events.removeEventListener('scroll', onScroll)
    for (const [axis, drag, trackDown] of handlers) {
      thumb[axis].removeEventListener('pointerenter', onEnter)
      thumb[axis].removeEventListener('pointerleave', onLeave)
      thumb[axis].removeEventListener('pointerdown', drag)
      track[axis].removeEventListener('pointerdown', trackDown)
    }
    if (parts.external) {
      setData(root, 'overflow', 'false')
      setData(root, 'visible', 'false')
    } else {
      root.remove()
    }
  }

  return {
    update,
    reveal,
    scrollTo,
    setOptions,
    destroy,
    root,
    isOverflowing: overflowing,
  }
}
