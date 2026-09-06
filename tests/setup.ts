// jsdom has MutationObserver but not ResizeObserver. A minimal stand-in lets the controller wire
// up; tests that care about resize behaviour trigger `update()` directly.
const ResizeObserverStub: typeof ResizeObserver = class {
  private readonly targets = new Set<Element>()
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(el: Element): void {
    this.targets.add(el)
  }
  unobserve(el: Element): void {
    this.targets.delete(el)
  }
  disconnect(): void {
    this.targets.clear()
  }
  /** Test helper: fire the callback as if every observed element resized. */
  trigger(): void {
    this.cb([], this)
  }
}

// jsdom does not implement ResizeObserver; the type says it exists, the runtime disagrees.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub
}

// jsdom implements neither pointer capture nor scrollTo on elements.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
}
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function (this: Element, ...args: unknown[]): void {
    const options = args[0]
    if (typeof options === 'object' && options !== null) {
      const { top, left } = options as ScrollToOptions
      if (top !== undefined) this.scrollTop = top
      if (left !== undefined) this.scrollLeft = left
    }
  }
}
