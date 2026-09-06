import { describe, expect, it } from 'vitest'
import { clamp, computeAxis, dragToScroll, thumbOffset, thumbSize } from '../../src/core/metrics'

describe('clamp', () => {
  it.each([
    [5, 0, 10, 5],
    [-1, 0, 10, 0],
    [11, 0, 10, 10],
    [3, 3, 3, 3],
  ])('clamp(%d, %d, %d) = %d', (n, min, max, expected) => {
    expect(clamp(n, min, max)).toBe(expected)
  })
})

describe('thumbSize', () => {
  it('is proportional: a 3-screen page gets a third-height thumb', () => {
    expect(thumbSize(900, 2700, 900, 44)).toBe(300)
  })
  it('floors at the minimum on very long pages', () => {
    expect(thumbSize(900, 36000, 900, 44)).toBe(44)
  })
  it('never exceeds the track, even when the track is shorter than the minimum', () => {
    expect(thumbSize(900, 36000, 30, 44)).toBe(30)
  })
  it('equals the track when content fits', () => {
    expect(thumbSize(900, 900, 900, 44)).toBe(900)
  })
  it('returns 0 for degenerate inputs', () => {
    expect(thumbSize(900, 0, 900, 44)).toBe(0)
    expect(thumbSize(900, 2700, 0, 44)).toBe(0)
  })
})

describe('thumbOffset', () => {
  it('maps the scroll ratio onto the travel, not the track', () => {
    // 3-screen page: maxScroll 1800, thumb 300, travel 600.
    expect(thumbOffset(0, 1800, 600)).toBe(0)
    expect(thumbOffset(900, 1800, 600)).toBe(300)
    expect(thumbOffset(1800, 1800, 600)).toBe(600)
  })
  it('absorbs rubber-band overscroll', () => {
    expect(thumbOffset(-120, 1800, 600)).toBe(0)
    expect(thumbOffset(2000, 1800, 600)).toBe(600)
  })
  it('is 0 when there is nothing to scroll', () => {
    expect(thumbOffset(100, 0, 600)).toBe(0)
    expect(thumbOffset(100, 1800, 0)).toBe(0)
  })
})

describe('dragToScroll', () => {
  it('converts pointer pixels to scroll pixels at maxScroll / travel', () => {
    // 3 scroll px per pointer px.
    expect(dragToScroll(100, 600, 1800, 0)).toBe(300)
  })
  it('is anchored to the drag start', () => {
    expect(dragToScroll(-50, 600, 1800, 900)).toBe(750)
  })
  it('clamps at both ends and does not eat travel on the way back', () => {
    expect(dragToScroll(10000, 600, 1800, 0)).toBe(1800)
    expect(dragToScroll(-10000, 600, 1800, 900)).toBe(0)
    // Drag past the end and back: the same delta returns to the same place.
    const out = dragToScroll(700, 600, 1800, 0)
    expect(out).toBe(1800)
    expect(dragToScroll(200, 600, 1800, 0)).toBe(600)
  })
  it('round-trips with thumbOffset', () => {
    for (const scroll of [0, 137, 900, 1799, 1800]) {
      const offset = thumbOffset(scroll, 1800, 600)
      expect(dragToScroll(offset, 600, 1800, 0)).toBeCloseTo(scroll, 6)
    }
  })
  it('returns the clamped start when there is no travel', () => {
    expect(dragToScroll(50, 0, 1800, 400)).toBe(400)
    expect(dragToScroll(50, 600, 0, 400)).toBe(0)
  })
})

describe('computeAxis', () => {
  it('resolves a scrolling axis', () => {
    expect(
      computeAxis({ viewport: 900, content: 2700, track: 900, scroll: 1800, minThumb: 44 }),
    ).toEqual({ overflow: true, maxScroll: 1800, thumb: 300, travel: 600, offset: 600 })
  })
  it('reports no overflow when content fits', () => {
    expect(computeAxis({ viewport: 900, content: 900, track: 900, scroll: 0, minThumb: 44 })).toEqual({
      overflow: false,
      maxScroll: 0,
      thumb: 0,
      travel: 0,
      offset: 0,
    })
  })
  it('ignores sub-pixel overflow from rounding', () => {
    expect(
      computeAxis({ viewport: 900, content: 900.4, track: 900, scroll: 0, minThumb: 44 }).overflow,
    ).toBe(false)
  })
})
