/**
 * Pure geometry. No DOM, no side effects. Everything the controller draws derives from these.
 */

export const clamp = (n: number, min: number, max: number): number =>
  n < min ? min : n > max ? max : n

/**
 * Thumb length: the same fraction of the track that the viewport is of the content, floored at
 * `min` so very long pages still yield a grabbable target, and capped at the track itself.
 */
export const thumbSize = (viewport: number, content: number, track: number, min: number): number => {
  if (content <= 0 || track <= 0) return 0
  const raw = (viewport / content) * track
  // Apply the floor first, then cap at the track, so a track shorter than `min` still wins.
  return clamp(clamp(raw, min, Number.POSITIVE_INFINITY), 0, track)
}

/**
 * Thumb offset along the track. The scroll ratio maps onto the *travel* (`track − thumb`), not the
 * track, so at the end of the content the thumb's far edge lands on the track's far edge.
 * `scroll` is clamped to absorb rubber-band overscroll.
 */
export const thumbOffset = (scroll: number, maxScroll: number, travel: number): number => {
  if (maxScroll <= 0 || travel <= 0) return 0
  return (clamp(scroll, 0, maxScroll) / maxScroll) * travel
}

/**
 * Drag: pointer pixels → scroll pixels, anchored to where the drag started so rounding never
 * drifts and clamping at the edges never "eats" travel.
 */
export const dragToScroll = (
  pointerDelta: number,
  travel: number,
  maxScroll: number,
  startScroll: number,
): number => {
  if (travel <= 0 || maxScroll <= 0) return clamp(startScroll, 0, Math.max(0, maxScroll))
  return clamp(startScroll + (pointerDelta / travel) * maxScroll, 0, maxScroll)
}

export interface AxisInput {
  viewport: number
  content: number
  track: number
  scroll: number
  minThumb: number
}

export interface AxisMetrics {
  overflow: boolean
  maxScroll: number
  thumb: number
  travel: number
  offset: number
}

/** One axis, fully resolved. */
export const computeAxis = ({ viewport, content, track, scroll, minThumb }: AxisInput): AxisMetrics => {
  // Sub-pixel rounding can leave scrollHeight a fraction above clientHeight on a page that does
  // not actually scroll; ignore anything under a pixel.
  const maxScroll = Math.max(0, content - viewport)
  const overflow = maxScroll >= 1
  if (!overflow) return { overflow, maxScroll: 0, thumb: 0, travel: 0, offset: 0 }
  const thumb = thumbSize(viewport, content, track, minThumb)
  const travel = Math.max(0, track - thumb)
  const offset = thumbOffset(scroll, maxScroll, travel)
  return { overflow, maxScroll, thumb, travel, offset }
}
