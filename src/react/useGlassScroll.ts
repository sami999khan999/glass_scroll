import * as React from 'react'
import type { ScrollToOptions, SingleAxis } from '../core/types'
import type { GlassScrollAreaHandle } from './GlassScrollArea'
import { getDocumentInstance } from './instances'

export interface GlassScrollHandle {
  /** Show the bar and arm the auto-hide timer. */
  reveal: () => void
  /** Force a re-measure, e.g. after mutating the DOM outside React. */
  update: () => void
  /** Scroll the underlying scroller. Defaults to `behavior: 'instant'`. */
  scrollTo: (options: ScrollToOptions) => void
  readonly isOverflowing: Readonly<Record<SingleAxis, boolean>>
}

/**
 * Imperative access to the document overlay (no argument) or to a specific
 * `<GlassScrollArea ref={...}>` (pass its ref). Safe to call before mount; methods no-op.
 */
export function useGlassScroll(
  areaRef?: React.RefObject<GlassScrollAreaHandle | null>,
): GlassScrollHandle {
  return React.useMemo<GlassScrollHandle>(() => {
    const target = () => (areaRef ? areaRef.current : getDocumentInstance())
    return {
      reveal: () => target()?.reveal(),
      update: () => target()?.update(),
      scrollTo: (o) => target()?.scrollTo(o),
      get isOverflowing() {
        return target()?.isOverflowing ?? { x: false, y: false }
      },
    }
  }, [areaRef])
}
