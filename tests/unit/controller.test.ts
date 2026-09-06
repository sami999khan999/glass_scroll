import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGlassScroll } from '../../src/core/controller'
import { subscriberCount } from '../../src/core/registry'
import type { GlassScrollInstance } from '../../src/core/types'

/** jsdom has no layout; pin the geometry the controller reads. */
const geometry = (el: HTMLElement, o: { clientHeight?: number; scrollHeight?: number; clientWidth?: number; scrollWidth?: number }) => {
  for (const [k, v] of Object.entries(o)) {
    Object.defineProperty(el, k, { configurable: true, get: () => v })
  }
}

const pointer = (type: string, init: PointerEventInit & { clientY?: number; clientX?: number } = {}) =>
  new MouseEvent(type, { bubbles: true, cancelable: true, ...init }) as PointerEvent

describe('createGlassScroll (element mode)', () => {
  let host: HTMLDivElement
  let el: HTMLDivElement
  let instance: GlassScrollInstance
  const track = () => instance.root!.querySelector<HTMLElement>('.gs-track--y')!
  const thumb = () => instance.root!.querySelector<HTMLElement>('.gs-thumb--y')!

  beforeEach(() => {
    vi.useFakeTimers()
    host = document.createElement('div')
    host.style.position = 'relative'
    el = document.createElement('div')
    host.appendChild(el)
    document.body.appendChild(host)
    // 100px pane, 300px of content: maxScroll 200, raw thumb 33 -> floored to 44, travel 56.
    geometry(el, { clientHeight: 100, scrollHeight: 300, clientWidth: 100, scrollWidth: 100 })
    instance = createGlassScroll(el, { hideDelay: 500, revealOnMount: false })
    geometry(track(), { clientHeight: 100 })
    instance.update()
  })

  afterEach(() => {
    instance.destroy()
    host.remove()
    vi.useRealTimers()
  })

  it('appends a local overlay next to the target and reports overflow', () => {
    const root = instance.root!
    expect(root.parentElement).toBe(host)
    expect(root.classList.contains('gs-root--local')).toBe(true)
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.dataset.overflow).toBe('true')
    expect(root.dataset.overflowY).toBe('true')
    expect(root.dataset.overflowX).toBe('false')
    expect(instance.isOverflowing).toEqual({ x: false, y: true })
  })

  it('sizes and positions the thumb from the metrics', () => {
    expect(thumb().style.height).toBe('44px')
    expect(thumb().style.transform).toBe('translate3d(0,0px,0)')
    el.scrollTop = 200
    instance.update()
    expect(thumb().style.transform).toBe('translate3d(0,56px,0)')
  })

  it('coalesces scroll events into one update per frame and reveals', () => {
    const root = instance.root!
    expect(root.dataset.visible).toBe('false')
    el.scrollTop = 100
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(new Event('scroll'))
    expect(root.dataset.visible).toBe('true')
    // Not yet painted.
    expect(thumb().style.transform).toBe('translate3d(0,0px,0)')
    vi.advanceTimersByTime(20)
    expect(thumb().style.transform).toBe('translate3d(0,28px,0)')
  })

  it('fades after hideDelay and stays pinned while hovering', () => {
    const root = instance.root!
    instance.reveal()
    expect(root.dataset.visible).toBe('true')
    vi.advanceTimersByTime(499)
    expect(root.dataset.visible).toBe('true')
    vi.advanceTimersByTime(1)
    expect(root.dataset.visible).toBe('false')

    instance.reveal()
    thumb().dispatchEvent(pointer('pointerenter'))
    vi.advanceTimersByTime(5000)
    expect(root.dataset.visible).toBe('true')
    expect(root.dataset.hovering).toBe('true')
    thumb().dispatchEvent(pointer('pointerleave'))
    expect(root.dataset.hovering).toBeUndefined()
    vi.advanceTimersByTime(500)
    expect(root.dataset.visible).toBe('false')
  })

  it('drags: pointer pixels become scroll pixels, anchored to the start', () => {
    const root = instance.root!
    thumb().dispatchEvent(pointer('pointerdown', { clientY: 10, button: 0 }))
    expect(root.dataset.dragging).toBe('y')
    // 28 pointer px over a 56px travel is half of maxScroll 200.
    window.dispatchEvent(pointer('pointermove', { clientY: 38 }))
    expect(el.scrollTop).toBe(100)
    expect(thumb().style.transform).toBe('translate3d(0,28px,0)')
    // Past the end clamps; coming back lands exactly.
    window.dispatchEvent(pointer('pointermove', { clientY: 500 }))
    expect(el.scrollTop).toBe(200)
    window.dispatchEvent(pointer('pointermove', { clientY: 38 }))
    expect(el.scrollTop).toBe(100)
    window.dispatchEvent(pointer('pointerup'))
    expect(root.dataset.dragging).toBeUndefined()
    vi.advanceTimersByTime(500)
    expect(root.dataset.visible).toBe('false')
  })

  it('reveals when the pointer nears the edge, but not for touch', () => {
    const root = instance.root!
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}),
    })
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 50 }))
    expect(root.dataset.visible).toBe('false')
    document.dispatchEvent(pointer('pointermove', { clientX: 70, clientY: 50 }))
    expect(root.dataset.visible).toBe('true')
    vi.advanceTimersByTime(500)
    expect(root.dataset.visible).toBe('false')
    // Outside the element's band: nothing.
    document.dispatchEvent(pointer('pointermove', { clientX: 90, clientY: 150 }))
    expect(root.dataset.visible).toBe('false')
  })

  it('drops the bar when content shrinks to fit', () => {
    geometry(el, { scrollHeight: 100 })
    instance.update()
    expect(instance.root!.dataset.overflow).toBe('false')
    expect(instance.isOverflowing.y).toBe(false)
  })

  it('setOptions applies autoHide=false immediately', () => {
    instance.setOptions({ autoHide: false })
    expect(instance.root!.dataset.visible).toBe('true')
    vi.advanceTimersByTime(5000)
    expect(instance.root!.dataset.visible).toBe('true')
  })

  it('track click pages when enabled and is ignored when the thumb is the target', () => {
    instance.setOptions({ trackClick: 'page' })
    expect(instance.root!.dataset.trackClick).toBe('page')
    vi.spyOn(track(), 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 12, bottom: 100, width: 12, height: 100, x: 0, y: 0, toJSON: () => ({}),
    })
    track().dispatchEvent(pointer('pointerdown', { clientY: 90, clientX: 5, button: 0 }))
    expect(el.scrollTop).toBe(100)
  })
})

describe('lifecycle', () => {
  it('destroy removes the overlay and the shared listeners; recreate leaves one subscriber', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const a = createGlassScroll(el)
    expect(subscriberCount()).toBe(1)
    const b = createGlassScroll(el)
    expect(subscriberCount()).toBe(2)
    a.destroy()
    b.destroy()
    expect(subscriberCount()).toBe(0)
    expect(document.querySelector('.gs-root')).toBeNull()
    const c = createGlassScroll(el)
    expect(subscriberCount()).toBe(1)
    c.destroy()
    a.destroy() // idempotent
    el.remove()
  })

  it('adopts an external root and leaves it in place on destroy', () => {
    const el = document.createElement('div')
    const root = document.createElement('div')
    root.className = 'gs-root'
    document.body.append(el, root)
    const instance = createGlassScroll(el, { root })
    expect(instance.root).toBe(root)
    expect(root.querySelector('.gs-thumb--y')).not.toBeNull()
    expect(root.querySelector('.gs-thumb--x')).not.toBeNull()
    instance.destroy()
    expect(root.isConnected).toBe(true)
    expect(root.dataset.visible).toBe('false')
    el.remove()
    root.remove()
  })

  it('window mode mirrors the document', () => {
    const doc = document.documentElement
    geometry(doc, { clientHeight: 500, scrollHeight: 1500, clientWidth: 800, scrollWidth: 800 })
    const instance = createGlassScroll(window)
    const root = instance.root!
    expect(root.parentElement).toBe(document.body)
    expect(root.classList.contains('gs-root--local')).toBe(false)
    geometry(root.querySelector('.gs-track--y')!, { clientHeight: 500 })
    instance.update()
    expect(root.dataset.overflowY).toBe('true')
    expect(root.dataset.overflowX).toBe('false')
    // thumb = 500/1500*500 = 166.67
    expect(root.querySelector<HTMLElement>('.gs-thumb--y')!.style.height).toMatch(/^166\.6/)
    instance.destroy()
  })
})
