# Custom Scrollbar — Complete Guide

How the app's glass overlay scrollbar works: what it replaces, the two modes it
runs in, the exact math behind the thumb, the event/lifecycle model, and the CSS
contract that keeps it from ever showing up on a page that can't scroll.

> **TL;DR** — There are **two independent scrollbar systems** in this app. A
> pure-CSS themed *native* scrollbar (`* { scrollbar-width: thin }` + the
> `::-webkit-scrollbar-*` rules) styles every ordinary scroll container. On top
> of that, `<CustomScrollbar />` is a **JS-driven overlay thumb** used in exactly
> two places — the document (mounted in `__root.tsx`) and the dashboard `<main>`
> pane (mounted in `dashboard/shell.tsx`). The overlay never reserves layout
> width, so turning it on doesn't shift content. It draws nothing itself but a
> pill: a `<div>` positioned by `transform: translate3d(...)` once per animation
> frame.

Files involved:

| File | Role |
| --- | --- |
| `src/components/ui/custom-scrollbar.tsx` | The whole component — markup + imperative effect |
| `src/styles.css:250-355` | Overlay skin (`.cscroll`, `.cscroll-track`, `.cscroll-thumb`, dark mode, reduced motion) |
| `src/styles.css:161-198` | The *other* system: themed native scrollbars for everything else |
| `src/styles.css:453-462` | `.no-scrollbar` utility — the opt-out an element-mode host must apply |
| `src/routes/__root.tsx:96` | Window-mode mount |
| `src/components/dashboard/shell.tsx:37` | Element-mode mount |

---

## 1. The big picture

```
                 NATIVE (CSS only)                    OVERLAY (JS)
    every scrollable box: dialogs,          the document  +  dashboard <main>
    dropdowns, tables, popovers…
                 │                                          │
                 │  * { scrollbar-width: thin }             │  <CustomScrollbar />
                 │  *::-webkit-scrollbar-thumb { … }        │  <CustomScrollbar targetRef={ref} />
                 ▼                                          ▼
        ┌────────────────────┐                    ┌──────────────────────────┐
        │ browser paints a   │                    │ fixed/absolute 12px strip │
        │ real 10px gutter   │                    │ pointer-events: none      │
        │ inside the box     │                    │   └ 6px thumb (interactive)│
        └────────────────────┘                    │ opacity toggled by two    │
                                                  │ data-attributes           │
                                                  └──────────────────────────┘
                                                       ▲            ▲
                                       scroll / resize │            │ pointermove
                                       ResizeObserver  │            │ (edge reveal)
```

Three ideas hold the overlay together:

1. **The strip is inert; only the thumb is not.** `.cscroll` is
   `pointer-events: none` so the 12px column over your content never eats a
   click. `.cscroll-thumb` re-enables `pointer-events: auto` for itself alone.
2. **Two boolean data-attributes gate visibility**, and CSS requires *both*:
   `data-overflow` (is there anything to scroll?) and `data-visible` (has
   something recently drawn attention to the bar?). A page that can't scroll can
   never flash a bar, no matter how the pointer moves.
3. **JS owns `transform` and `height`; CSS owns everything else.** The thumb's
   position is written by hand every frame, so those two properties are
   deliberately excluded from the CSS `transition` list — a transition on them
   would fight the per-frame writes and lag the pointer.

---

## 2. The two systems, and why both exist

### 2a. Native, themed (`src/styles.css:161`)

```css
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(130, 132, 140, 0.55) transparent;
}
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb {
  background-color: rgba(130, 132, 140, 0.55);
  border: 2px solid transparent;   /* inset via background-clip, not width */
  border-radius: 9999px;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.25), 0 0 0 1px rgba(0,0,0,.08);
  backdrop-filter: blur(4px);
}
```

This is the default for *every* scroll container in the app. The `2px`
transparent border plus `background-clip: padding-box` is the trick that makes a
10px gutter render a 6px pill with breathing room on both sides — matching the
overlay thumb's 6px width, so the two systems look like one design.

It reserves real layout width, which is fine inside a dialog or a dropdown but
not on the page itself.

### 2b. The overlay (`src/styles.css:244+`)

The document opts *out* of native rendering entirely:

```css
html { scrollbar-width: none; }
html::-webkit-scrollbar { width: 0; height: 0; display: none; }
```

Scoped to `html` **on purpose**: inner scroll areas keep their themed native bar
unless they explicitly opt out with `.no-scrollbar` *and* mount their own
element-mode instance. That's why `legal-doc-layout.tsx:104` and
`categories-row.tsx:12` use `.no-scrollbar` with no overlay at all — they're
horizontal snap/tab strips where a visible bar is just noise.

**Design consequence:** removing the document scrollbar removes the ~10-15px
gutter. Nothing shifts when a short page becomes a long one, and `100dvh`
elements aren't off-center. That is the entire reason this component exists.

---

## 3. The two modes

The component takes exactly one optional prop:

```ts
const CustomScrollbar = ({ targetRef }: { targetRef?: React.RefObject<HTMLElement | null> }) => …
```

`targetRef` is the mode switch — its presence changes the scroller, the
positioning strategy, the class name, and the first-paint behavior.

| | **Window mode** (`<CustomScrollbar />`) | **Element mode** (`<CustomScrollbar targetRef={ref} />`) |
| --- | --- | --- |
| Scroller | `window` | the target element |
| Scroll offset | `window.scrollY` | `target.scrollTop` |
| Viewport height | `window.innerHeight` | `target.clientHeight` |
| Content height | `document.documentElement.scrollHeight` | `target.scrollHeight` |
| Track height | `window.innerHeight` | `bar.clientHeight` |
| Class | `.cscroll` → `position: fixed; height: 100dvh` | `.cscroll--local` → `position: absolute; inset top/right/bottom` |
| Programmatic scroll | `window.scrollTo({ behavior: 'instant' })` | `target.scrollTop = n` |
| ResizeObserver watches | `document.body` | the target **and each of its direct children** |
| On mount | just `update()` | `update()` **plus one `reveal()` flash** |
| Where mounted | `src/routes/__root.tsx:96` | `src/components/dashboard/shell.tsx:37` |

### Element mode's host contract

The component can't set these itself — the host must:

```tsx
{/* Positioned wrapper — the overlay scrollbar pins to it */}
<div className="relative flex grow flex-col overflow-hidden">
  <main
    ref={mainRef}
    tabIndex={0}                                   {/* keeps it keyboard-scrollable */}
    className="no-scrollbar block grow overflow-y-auto …"  {/* hides the native bar */}
  >
    <div className="container mx-auto">{children}</div>
  </main>
  <CustomScrollbar targetRef={mainRef} />
</div>
```

Three requirements, all present above:

1. **A positioned ancestor.** `.cscroll--local` is `position: absolute`, so it
   pins to the nearest positioned ancestor — hence `relative` on the wrapper. Get
   this wrong and the bar flies to the document corner.
2. **`.no-scrollbar` on the scroller.** Otherwise you get the native bar *and*
   the overlay, double-drawn.
3. **`tabIndex={0}`.** Hiding a scrollbar doesn't hide the scroll; but a `<main>`
   that isn't focusable can't be scrolled with the keyboard by users who reach it
   via Tab. This restores <kbd>↑</kbd>/<kbd>↓</kbd>/<kbd>PgDn</kbd>/<kbd>Space</kbd>.

The window mode has no contract — `__root.tsx` just drops `<CustomScrollbar />`
in the `<body>`, and the `html { scrollbar-width: none }` rule in `styles.css`
already handles the hide.

---

## 4. The math

Everything derives from one function (`custom-scrollbar.tsx:45`):

```ts
const metrics = () => {
  const clientH  = target ? target.clientHeight  : window.innerHeight
  const scrollH  = target ? target.scrollHeight  : root.scrollHeight
  const maxScroll = scrollH - clientH                          // total scrollable distance
  const trackH    = target ? bar.clientHeight : clientH         // the channel the thumb runs in
  const thumbH    = clamp((clientH / scrollH) * trackH, THUMB_MIN, trackH)
  return { trackH, maxScroll, thumbH }
}
```

- **`thumbH` is proportional**: the thumb takes the same fraction of the track
  that the viewport takes of the content. A 3-screen page gets a ⅓-height thumb.
- **`THUMB_MIN = 44`** floors it, so a 40-screen page still yields a grabbable
  44px target (a rough touch-target minimum) rather than a 12px sliver. The
  `clamp`'s upper bound is `trackH` itself, which matters only in the degenerate
  case where `trackH < THUMB_MIN` — clamp's `min` is applied first, then `max`,
  so the thumb can never exceed the track.
- `metrics()` is recomputed on demand rather than cached, because *every* input
  can change without a scroll event (window resize, sidebar collapse, an image
  finishing load, a route swap).

Then the position (`custom-scrollbar.tsx:55`):

```ts
const update = () => {
  const { trackH, maxScroll, thumbH } = metrics()
  bar.dataset.overflow = maxScroll > 0 ? 'true' : 'false'
  if (maxScroll <= 0) return
  const y = (clamp(scrollTop(), 0, maxScroll) / maxScroll) * (trackH - thumbH)
  thumb.style.height = `${thumbH}px`
  thumb.style.transform = `translate3d(0, ${y}px, 0)`
}
```

The scroll ratio `scrollTop / maxScroll` (0→1) maps onto the **travel**,
`trackH - thumbH` — not `trackH` — so at the bottom of the page the thumb's
*bottom* edge lands on the track's bottom edge, not its top edge.

`clamp(scrollTop(), 0, maxScroll)` absorbs rubber-band overscroll on iOS/macOS,
where `scrollY` legitimately goes negative or past `maxScroll`; without it the
thumb would visibly shoot past the track ends during a bounce.

`translate3d` (rather than `top`) keeps the thumb on the compositor — combined
with `will-change: transform, height` in CSS, moving it doesn't trigger layout.

### Drag math

Dragging is the same mapping run backwards (`custom-scrollbar.tsx:123`):

```ts
const delta = ((e.clientY - dragStartY) / travel) * maxScroll
const next  = clamp(dragStartScroll + delta, 0, maxScroll)
```

Pointer pixels → scroll pixels, scaled by `maxScroll / travel`. Anchoring to
`dragStartY`/`dragStartScroll` (captured on `pointerdown`) rather than
accumulating per-move deltas means rounding never drifts, and clamping at the
edges never "eats" travel — drag past the bottom and back and the thumb returns
exactly where it left.

The last line of `onDragMove` is a deliberate duplicate of what `update()` would
do:

```ts
// Move the thumb in this same event so it never trails the pointer
thumb.style.transform = `translate3d(0, ${(next / maxScroll) * travel}px, 0)`
```

Without it the thumb would only move once the *scroll* event fires and the rAF
lands — a frame or two behind the cursor, which reads as rubbery lag on exactly
the interaction where precision matters most.

---

## 5. Visibility state machine

Three variables live in the effect closure — `hovering`, `dragging`, and
`hideTimer` — and two data-attributes on the bar element carry the result to CSS.

```
                       ┌──────────────────────────────────────────┐
   scroll event ──────►│                                          │
   pointer within 44px │            reveal()                      │
   of the right edge ─►│   data-visible = 'true'                  │
   mount (element mode)│   + scheduleHide()                       │
                       └──────────────┬───────────────────────────┘
                                      │ 1100ms with no new reveal
                                      │ AND !hovering AND !dragging
                                      ▼
                            data-visible = 'false'   (opacity → 0, 0.3s ease)

   thumb pointerenter → hovering = true,  clearTimeout, visible = 'true'  (pinned up)
   thumb pointerleave → hovering = false, scheduleHide()
   thumb pointerdown  → dragging = true,  data-dragging = 'true', clearTimeout (pinned up)
   pointerup/cancel   → dragging = false, delete data-dragging, scheduleHide()
```

And the CSS gate (`src/styles.css:273`):

```css
.cscroll { opacity: 0; transition: opacity .3s ease; }
.cscroll[data-overflow='true'][data-visible='true'] { opacity: 1; }
```

Both attributes must be `'true'`. `data-overflow` is rewritten on every
`update()` from `maxScroll > 0`, so a page that shrinks below one viewport
silently drops its bar without any separate teardown path.

Note `scheduleHide()` is a no-op while hovering or dragging — it returns *before*
arming the timer, so the bar is pinned up for as long as you're interacting with
it, and only starts its 1100ms countdown once you let go.

### The three constants (`custom-scrollbar.tsx:3-5`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `THUMB_MIN` | `44` | Minimum thumb height in px — grabbability floor on very long pages |
| `EDGE_REVEAL` | `44` | How close to the scroller's right edge the pointer must come to flash the bar |
| `HIDE_DELAY` | `1100` | ms of quiet before the bar fades out |

### Edge reveal (`custom-scrollbar.tsx:95`)

A `pointermove` listener on `document` (passive) reveals the bar when the cursor
approaches. The two modes measure differently:

- **Window mode:** one comparison — `window.innerWidth - e.clientX <= 44`.
- **Element mode:** the pointer must be inside the target's vertical band *and*
  left of its right edge *and* within 44px of it:

  ```ts
  const r = target.getBoundingClientRect()
  const inside = e.clientY >= r.top && e.clientY <= r.bottom
  if (inside && e.clientX <= r.right && r.right - e.clientX <= EDGE_REVEAL) reveal()
  ```

  The `e.clientX <= r.right` half is what stops the dashboard bar from flashing
  when the pointer is over something to the *right* of `<main>`.

The whole handler early-returns while `dragging` — during a drag the bar is
already pinned, and re-arming the hide timer on every move would be pure waste.

---

## 6. Lifecycle and event wiring

Everything happens inside a single `React.useEffect` keyed on `[targetRef]`. The
component renders once and then never re-renders from its own state — there is
no `useState` anywhere in it, which is the point: scroll position in React state
would mean a render per frame.

**Setup** (`custom-scrollbar.tsx:163-182`):

```ts
const scroller: EventTarget = target ?? window
scroller.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', schedule)
document.addEventListener('pointermove', onPointerMove, { passive: true })
thumb.addEventListener('pointerenter', onThumbEnter)
thumb.addEventListener('pointerleave', onThumbLeave)
thumb.addEventListener('pointerdown', onThumbDown)

const observer = new ResizeObserver(schedule)
if (target) {
  observer.observe(target)
  for (const child of Array.from(target.children)) observer.observe(child)
} else {
  observer.observe(document.body)
}

update()
if (target) reveal()   // element mode flashes once so scrollability is discoverable
```

Points worth knowing:

- **`{ passive: true }`** on `scroll` and `pointermove` promises the browser these
  handlers never call `preventDefault()`, so scrolling is never blocked waiting
  on them.
- **The ResizeObserver watches children, not just the target.** Resizing the
  `<main>` box fires for the box; but content *growing inside* it (a table
  loading rows, an accordion opening) changes `scrollHeight` without changing
  `main`'s own size. Observing the direct children catches that. The list is
  snapshotted at mount — children added later by React aren't observed, though in
  practice the dashboard renders a single stable `<div class="container">`
  wrapper whose own resize covers its subtree.
- **Window mode observes `document.body`** for the same reason.
- Native listeners (not React props) are used throughout because the elements are
  reached by ref and never re-render — there's no prop-diffing to pay for.

**rAF coalescing** (`custom-scrollbar.tsx:66`):

```ts
const schedule = () => {
  if (frame) return
  frame = requestAnimationFrame(() => { frame = 0; update() })
}
```

A fast wheel spin fires dozens of `scroll` events per frame; the `if (frame)`
guard collapses them into one `update()` per painted frame. Note `onScroll` calls
`schedule()` (coalesced) but `reveal()` directly — setting a data-attribute to
the value it already has is free, so there's nothing to coalesce there.

**Drag capture** (`custom-scrollbar.tsx:149`):

`onThumbDown` calls `e.preventDefault()` (kills the native text-selection drag),
sets `thumb.setPointerCapture(e.pointerId)` so the thumb keeps receiving events
even when the pointer leaves the 6px pill, and attaches
`pointermove`/`pointerup`/`pointercancel` to `window`. Listening on `window`
rather than the thumb is what lets you drag far outside the browser's content
area and still control the scroll.

`onDragEnd` wraps `releasePointerCapture` in `try/catch` — the capture may
already be implicitly released (e.g. `pointercancel`), and that throws.

**Teardown** (`custom-scrollbar.tsx:184-197`): cancels the pending rAF, clears
the hide timer, disconnects the observer, and removes all nine listeners —
including the three drag listeners, which matters if the component unmounts
mid-drag.

---

## 7. The skin

```css
.cscroll {
  position: fixed; top: 0; right: 0; z-index: 9998;
  width: 12px; height: 100dvh;
  opacity: 0;
  pointer-events: none;          /* only the thumb is interactive */
  transition: opacity .3s ease;
}
.cscroll-track { position: absolute; inset: 0; }   /* a channel only — paints nothing */
.cscroll-thumb {
  position: absolute; top: 0; right: 3px;
  width: 6px; border-radius: 9999px;
  background-color: rgba(130, 132, 140, .55);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), 0 1px 3px rgba(0,0,0,.18);
  backdrop-filter: blur(4px);
  pointer-events: auto; cursor: grab;
  will-change: transform, height;
  /* Never transition transform/height — JS owns those per frame */
  transition: width .18s ease, right .18s ease, background-color .18s ease, box-shadow .18s ease;
}
```

- `.cscroll-track` renders **nothing** — no background, no border. It exists so
  element mode has a measurable `bar.clientHeight` channel and so the structure
  reads as track+thumb. Painting it would reintroduce the visual gutter the whole
  component is designed to remove.
- `z-index: 9998` sits the overlay under a modal/toast layer but above page
  content; element mode drops to `z-index: 30`, scoped inside the dashboard
  stacking context.
- **`backdrop-filter: blur(4px)`** is what makes it read as *glass*: the thumb is
  only 55% opaque, so text scrolling underneath is blurred rather than legible
  through it.
- **The hover/drag growth is `right: 3px→2px` and `width: 6px→8px`.** Both
  change together so the thumb grows *leftward* — its right edge stays 10px from
  the viewport edge, so it doesn't appear to jump sideways when you touch it.
- **The transition list deliberately excludes `transform` and `height`.** Those
  are written every frame by JS; a CSS transition on them would interpolate
  toward a target that has already moved, producing lag and a permanently
  "catching up" thumb.
- `content: none !important` on `::before`/`::after` is a defensive guard so no
  shared glass-sheen utility elsewhere in the stylesheet can leak a pseudo-element
  onto the thumb.
- **Dark mode** inverts the tint — a light pill (`rgba(205,207,217,.32)`,
  brightening to `.55` on hover) with deeper shadows — via `.dark .cscroll-thumb`.
- **`prefers-reduced-motion: reduce`** kills the transitions on both `.cscroll`
  and `.cscroll-thumb`; the bar snaps in and out instead of fading. Thumb
  *movement* is unaffected, since it tracks the user's own scrolling rather than
  animating on its own.

### Family resemblance

The route progress bar (`.bprogress .bar`, `src/styles.css:203`, driven from
`src/router.tsx`) is intentionally the same material: same translucent neutral
fill, same `inset 0 0 0 1px rgba(255,255,255,…)` hairline, same
`backdrop-filter: blur(4px)`. It's described in the stylesheet as "the scrollbar
thumb, stretched across the top." If you retint one, retint the other and the
`::-webkit-scrollbar-thumb` rule too — three places, one material.

---

## 8. Behavior notes and known limits

- **`aria-hidden="true"`.** The overlay is a decorative duplicate of scroll state
  the browser already exposes; screen readers ignore it. Accessibility rests on
  the underlying element still being a real scroll container — hence the
  `tabIndex={0}` requirement in element mode.
- **No track-click paging.** Clicking the empty track does nothing; the strip is
  `pointer-events: none`, and only the thumb has a `pointerdown` handler. Adding
  page-up/page-down on track click would mean making the track interactive, which
  would start swallowing clicks on the content beneath it.
- **No horizontal mode.** Everything is Y-only. Horizontal scrollers in the app
  (the legal-doc tab strip, the home categories row) hide their bars with
  `.no-scrollbar` and rely on snap points instead.
- **Touch.** The bar is driven by `pointermove`, so on a touch device there's no
  hover-to-reveal — it appears on scroll and fades 1100ms later, which matches
  native mobile overlay-scrollbar behavior. Element mode's mount flash exists
  partly for this: it's the only hint that the pane scrolls.
- **SSR.** All measurement lives in `useEffect`, so nothing touches `window`
  during render. The server emits the bar at `data-overflow="false"
  data-visible="false"` — fully transparent — and the first client effect
  measures and corrects it.
- **The effect depends on `[targetRef]`,** the ref object identity, not
  `targetRef.current`. Swapping the *element* a stable ref points at won't re-run
  the effect; in practice `mainRef` is created once per shell mount and the shell
  outlives every route inside it, so this never comes up.

---

## 9. Adding a third instance

If a new pane needs the overlay rather than the themed native bar:

1. Wrap the scroller in a `relative` container that clips (`overflow-hidden`).
2. Give the scroller `overflow-y-auto`, `no-scrollbar`, and `tabIndex={0}`.
3. Hold a ref to the scroller and render `<CustomScrollbar targetRef={ref} />` as
   a *sibling* of the scroller, inside the `relative` wrapper.

```tsx
const paneRef = React.useRef<HTMLDivElement>(null)

<div className="relative flex grow flex-col overflow-hidden">
  <div ref={paneRef} tabIndex={0} className="no-scrollbar grow overflow-y-auto">
    {children}
  </div>
  <CustomScrollbar targetRef={paneRef} />
</div>
```

Don't reach for it by default. A dialog, dropdown, or table body is better served
by the themed native scrollbar — it costs nothing, needs no JS, and already looks
like the overlay. The overlay is for the rare case where a reserved gutter would
shift the layout or break a full-bleed design.
