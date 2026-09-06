/**
 * Watches for anything that changes scroll geometry without firing a `scroll` event: the target
 * resizing, content growing inside it, or children being added or removed.
 *
 * - `ResizeObserver` on the target and each direct child. Content growing *inside* a pane (a table
 *   loading rows, an accordion opening) changes `scrollHeight` without changing the pane's box, so
 *   the children are what actually report it.
 * - `MutationObserver` on the target's `childList` so children added later are observed too.
 */
export const observeContent = (target: HTMLElement | null, callback: () => void): (() => void) => {
  if (typeof ResizeObserver === 'undefined') return () => undefined

  const resize = new ResizeObserver(callback)
  const observed = new Set<Element>()

  const observe = (el: Element): void => {
    if (observed.has(el)) return
    observed.add(el)
    resize.observe(el)
  }

  const observeChildren = (parent: Element): void => {
    for (const child of Array.from(parent.children)) observe(child)
  }

  const host = target ?? document.body
  observe(host)
  if (!target) observe(document.documentElement)
  observeChildren(host)

  let mutation: MutationObserver | null = null
  if (typeof MutationObserver !== 'undefined') {
    mutation = new MutationObserver((records) => {
      let changed = false
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (node instanceof Element) {
            observe(node)
            changed = true
          }
        }
        for (const node of Array.from(record.removedNodes)) {
          if (node instanceof Element && observed.has(node)) {
            observed.delete(node)
            resize.unobserve(node)
            changed = true
          }
        }
      }
      if (changed) callback()
    })
    mutation.observe(host, { childList: true })
  }

  return () => {
    resize.disconnect()
    mutation?.disconnect()
    observed.clear()
  }
}
