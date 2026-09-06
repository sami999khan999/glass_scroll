/**
 * One `pointermove` listener on `document` and one `resize` listener on `window`, shared by every
 * live overlay. Ten scroll areas on a page still cost one listener each. The listeners are
 * attached on the first subscription and removed after the last unsubscribes.
 */

export interface RegistrySubscriber {
  onPointerMove?: (event: PointerEvent) => void
  onResize?: () => void
}

const subscribers = new Set<RegistrySubscriber>()
let attached = false

const handlePointerMove = (event: PointerEvent): void => {
  for (const sub of subscribers) sub.onPointerMove?.(event)
}

const handleResize = (): void => {
  for (const sub of subscribers) sub.onResize?.()
}

const attach = (): void => {
  if (attached || typeof document === 'undefined') return
  attached = true
  document.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('resize', handleResize, { passive: true })
}

const detach = (): void => {
  if (!attached) return
  attached = false
  document.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('resize', handleResize)
}

export const subscribe = (sub: RegistrySubscriber): (() => void) => {
  subscribers.add(sub)
  attach()
  return () => {
    subscribers.delete(sub)
    if (subscribers.size === 0) detach()
  }
}

/** Test hook: number of live subscribers. */
export const subscriberCount = (): number => subscribers.size
