import type { Axis, PartClassNames, SingleAxis } from './types'

export const CLASS = {
  root: 'gs-root',
  local: 'gs-root--local',
  track: 'gs-track',
  thumb: 'gs-thumb',
  trackY: 'gs-track--y',
  trackX: 'gs-track--x',
  thumbY: 'gs-thumb--y',
  thumbX: 'gs-thumb--x',
  scroller: 'gs-scroller',
  area: 'gs-area',
} as const

export interface OverlayParts {
  root: HTMLElement
  track: Record<SingleAxis, HTMLElement>
  thumb: Record<SingleAxis, HTMLElement>
  /** True when `root` was supplied by the caller rather than created here. */
  external: boolean
}

export const axes = (axis: Axis): SingleAxis[] => (axis === 'both' ? ['y', 'x'] : [axis])

const join = (...names: (string | undefined)[]): string => names.filter(Boolean).join(' ')

const make = (className: string): HTMLDivElement => {
  const el = document.createElement('div')
  el.className = className
  return el
}

/**
 * Builds the overlay DOM, or adopts an existing root that already contains it (the SSR case).
 * Both axes are always present in the DOM so the structure is stable; CSS hides the one that is
 * not in use via `data-axis` on the root.
 */
export const createOverlay = (
  root: HTMLElement | undefined,
  axis: Axis,
  local: boolean,
  classNames: PartClassNames = {},
): OverlayParts => {
  const external = Boolean(root)
  const rootEl =
    root ?? make(join(CLASS.root, local ? CLASS.local : undefined, classNames.root))

  const find = (cls: string): HTMLElement | null => rootEl.querySelector<HTMLElement>(`.${cls}`)

  const build = (
    trackCls: string,
    thumbCls: string,
    extraTrack?: string,
    extraThumb?: string,
  ): [HTMLElement, HTMLElement] => {
    const existingTrack = find(trackCls)
    const existingThumb = find(thumbCls)
    if (existingTrack && existingThumb) return [existingTrack, existingThumb]
    const track = make(join(CLASS.track, trackCls, extraTrack))
    const thumb = make(join(CLASS.thumb, thumbCls, extraThumb))
    track.appendChild(thumb)
    rootEl.appendChild(track)
    return [track, thumb]
  }

  const [trackY, thumbY] = build(CLASS.trackY, CLASS.thumbY, classNames.track, classNames.thumb)
  const [trackX, thumbX] = build(CLASS.trackX, CLASS.thumbX, classNames.trackX, classNames.thumbX)

  rootEl.setAttribute('aria-hidden', 'true')
  rootEl.dataset.axis = axis
  rootEl.dataset.overflow ??= 'false'
  rootEl.dataset.visible ??= 'false'

  return { root: rootEl, track: { y: trackY, x: trackX }, thumb: { y: thumbY, x: thumbX }, external }
}

/** Write a data attribute only when it changes; the style system reacts to these. */
export const setData = (el: HTMLElement, key: string, value: string | null): void => {
  if (value === null) {
    el.removeAttribute(`data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`)
    return
  }
  if (el.dataset[key] !== value) el.dataset[key] = value
}
