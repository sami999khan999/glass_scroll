# How it works

A two-part explainer written for the maintainer, not for package users.

- **Part 1** is about npm packages in general: what one actually is, what the fields in
  `package.json` do, why we ship two module formats, how the consumer's bundler sees our code,
  and what happens when you run `npm publish`.
- **Part 2** is about `glass-scroll` specifically: what happens, step by step, when someone
  drops `<GlassScroll />` into a Next.js layout, the maths behind the thumb, the state machine
  behind the fade, how the styles get onto the page without a CSS import, and why the same code
  works in every React framework.

The API and defaults referenced here are the ones defined in [`README.md`](./README.md). The
mechanics are lifted from the original in-app component described in
[`CUSTOM_SCROLLBAR.md`](./CUSTOM_SCROLLBAR.md) and generalised.

---

## Part 1: How npm packages work

### 1.1 A package is a folder with a `package.json`

That is the whole definition. When you run `npm install glass-scroll`, npm downloads a tarball,
extracts it into `node_modules/glass-scroll/`, and from then on `import { GlassScroll } from
'glass-scroll'` resolves to a file inside that folder. Which file is decided entirely by the
`package.json` inside it.

Nothing in the tarball is compiled by the consumer. Whatever we publish is what runs. So a
package is really two things:

1. **Source** (`src/`), written in TypeScript with JSX, which we keep in the repo and never publish.
2. **Build output** (`dist/`), plain JavaScript plus `.d.ts` type files, which is what actually
   ships.

The build step between them is the single most important thing to get right, because every
framework compatibility question is really a question about the build output.

### 1.2 The `package.json` fields that matter

```jsonc
{
  "name": "glass-scroll",          // the npm identifier; must be unique on the registry
  "version": "0.1.0",              // semver; consumers pin ranges against this
  "type": "module",                // .js files in this package are ES modules by default
  "sideEffects": false,            // promise to bundlers: importing a file changes nothing globally
  "files": ["dist", "styles.css"], // allow-list of what goes in the tarball
  "main": "./dist/index.cjs",      // legacy entry for old CommonJS tooling
  "module": "./dist/index.js",     // legacy entry for old ESM-aware bundlers
  "types": "./dist/index.d.ts",    // legacy entry for TypeScript
  "exports": { ... },              // the modern entry map; overrides the three above when present
  "peerDependencies": { "react": ">=18" },
  "engines": { "node": ">=18" }
}
```

**`exports`** is the one to understand. It is a map from *import specifier* to *file*, with a
condition per environment:

```jsonc
"exports": {
  ".": {                                    // import 'glass-scroll'
    "types":   "./dist/index.d.ts",         // TypeScript looks here first
    "import":  "./dist/index.js",           // ESM consumers (Vite, Next, modern Node)
    "require": "./dist/index.cjs"           // CommonJS consumers (Jest without ESM, old Node)
  },
  "./core": { ... },                        // import 'glass-scroll/core'
  "./styles.css": "./styles.css",           // import 'glass-scroll/styles.css'
  "./package.json": "./package.json"        // tooling sometimes needs to read it
}
```

Anything *not* listed in `exports` is unreachable from outside the package. That is a feature:
it lets us refactor `dist/` internals without breaking anyone, because nobody could have imported
`glass-scroll/dist/react/GlassScroll.js` in the first place.

**`peerDependencies` versus `dependencies`.** If we listed React under `dependencies`, npm might
install a second copy of React inside our package, and two Reacts on one page break hooks
("Invalid hook call"). `peerDependencies` says "I need React, but use *yours*". We mark it
optional in `peerDependenciesMeta` because the `glass-scroll/core` entry has no React at all.

**`sideEffects: false`** tells webpack, Rollup, and esbuild that importing any of our files does
nothing unless you use an export. That is what lets a consumer who only imports `GlassScrollArea`
drop `GlassScroll` and the native-theme CSS builder from their bundle. It is only honest if we
never run code at module top level, which is a rule we keep: the stylesheet is injected by the
*component*, not by the *import*.

### 1.3 ESM and CommonJS, and why we ship both

JavaScript has two module systems. **CommonJS** (`require()`, `module.exports`) is what Node
started with. **ES modules** (`import`/`export`) are the standard, and what every bundler and
modern Node prefer. They are not interchangeable at runtime, so a package that ships only one can
break some consumers:

- Only ESM: breaks Jest without ESM config, older Next.js server builds, some Electron setups.
- Only CJS: works almost everywhere, but loses tree-shaking and forces a wrapper in ESM consumers.

Shipping both costs a few kilobytes on disk and nothing at runtime, because a consumer only loads
one. The `exports` map's `import`/`require` conditions route each consumer to the right file.

### 1.4 Type declarations

TypeScript never reads our `.ts` source from `node_modules`. It reads `.d.ts` files, which are
the source with all the implementation stripped, leaving only the shapes. The build generates
them. Because `exports` has a `types` condition per entry, `import type { GlassScrollTheme } from
'glass-scroll'` works and so does `from 'glass-scroll/core'`.

Strict mode matters here more than in an app: a `// @ts-ignore` in a library becomes an
`any` in every consumer's editor. The plan is `strict: true`, `noUncheckedIndexedAccess`, and no
`any` in the public surface.

### 1.5 The build: what `tsup` does

`tsup` is a thin wrapper around esbuild. One config file turns `src/index.ts` and `src/core.ts` into:

```
dist/index.js      ESM bundle (React entry)
dist/index.cjs     CommonJS bundle (React entry)
dist/index.d.ts    types
dist/core.js       ESM bundle (framework-free entry)
dist/core.cjs
dist/core.d.ts
```

Each bundle is *one file* with all our internal modules inlined, and React left as an external
import. It also prepends `"use client";` to the React bundles (see 1.6) and produces
`styles.css` from the CSS string in `src/core/styles.ts` so the two never drift.

The consumer's bundler then treats our `dist/index.js` like any other ES module in their app:
it tree-shakes unused exports, minifies, and includes the result in their chunks. We do not
minify our own output, because a double-minified file is harder to debug and no smaller.

### 1.6 `"use client"` and React Server Components

In Next.js App Router, every file is a *server* component unless it or an ancestor in the import
chain starts with the `"use client"` directive. Server components run on the server only and
cannot use `useEffect`, `useRef`, or browser APIs.

Our component is all effects and DOM, so it must be a client component. The `"use client"`
banner at the top of `dist/index.js` marks the *boundary*: a server-component `layout.tsx` can
import `GlassScroll` and render it, Next serialises the props, and the component itself runs in
the browser (and once on the server for the initial HTML). The consumer does not need to write
`"use client"` anywhere. This is why the banner has to survive the build and sit at byte zero of
the file.

Outside Next, the directive is an inert string. Vite, Remix, and CRA ignore it.

### 1.7 Semantic versioning

`MAJOR.MINOR.PATCH`. Consumers usually depend on `^0.1.0` or `^1.2.3`, which means "any version
with the same major". So:

- **Patch** (`1.2.3` → `1.2.4`): bug fix, no API change.
- **Minor** (`1.2.x` → `1.3.0`): new prop, new export, new preset; everything old still works.
- **Major** (`1.x` → `2.0.0`): a prop renamed or removed, a default changed, a peer bumped.

Before `1.0.0` the rules loosen: `0.x` minors may break. That is why the first release is `0.1.0`
and `1.0.0` waits until the API has been used in anger.

Changesets automates this: each pull request adds a small markdown file saying "patch" or
"minor" plus a note; at release time they are folded into a version bump and a `CHANGELOG.md`.

### 1.8 Publishing

```
pnpm build            # dist/ and styles.css
pnpm pack             # produces glass-scroll-0.1.0.tgz, exactly what npm would upload
tar -tf glass-scroll-0.1.0.tgz   # look at it: dist/, styles.css, package.json, README, LICENSE
npm publish --access public --provenance
```

`--provenance` makes GitHub Actions sign the upload so npm can display where the tarball was
built from. The plan does this from CI on a git tag, never from a laptop, so a release is
reproducible and never includes uncommitted files.

### 1.9 Testing a package before it exists on npm

Two ways, and the plan uses both:

- **Workspace link.** `examples/next-app` lists `"glass-scroll": "workspace:*"` in its
  `package.json`. pnpm symlinks `node_modules/glass-scroll` to the repo root, so the example app
  consumes the real `dist/` output. Rebuild the package and the example sees the change.
- **Tarball install.** `pnpm pack`, then in a throwaway `create-next-app` run
  `pnpm add ../glass-scroll-0.1.0.tgz`. This is the only test that catches `files` allow-list
  mistakes and `exports` typos, because it goes through the exact path a real user would.

### 1.10 What the `examples/` folder is for

It is not documentation. It is the integration test bed and the Playwright target. The Next.js
example has a long page, a dialog with a scrolling body, a dropdown, a table, a wrapped
`GlassScrollArea`, a horizontal strip, and a dark-mode toggle. Every e2e test runs against it,
and every screenshot in the README will come from it.

---

## Part 2: How `glass-scroll` works

### 2.1 Two rendering systems

There are two completely separate ways a scrollbar gets styled, and the package uses both.

**The overlay** is a JavaScript-driven `<div>` pill positioned over the content. It reserves no
layout width. It is used on the document (by `<GlassScroll />`) and on any element wrapped in
`<GlassScrollArea>`. The browser still does the scrolling; we only draw and move a thumb that
mirrors the scroll position.

**The themed native bar** is pure CSS. `scrollbar-width`, `scrollbar-color`, and the
`::-webkit-scrollbar-*` pseudo-elements restyle the browser's own scrollbar inside any scroll
container. It reserves its normal gutter, costs no JavaScript, and is applied to every nested
container when `scope="all"`.

They are designed to look identical. The native rule reserves a 10px gutter but draws a 6px pill
inside it by giving the thumb a 2px transparent border and `background-clip: padding-box`. The
overlay thumb is also 6px wide, with the same colour, radius, hairline highlight, and
`backdrop-filter`. Both read their values from the same `--gs-*` custom properties, so one theme
drives both.

### 2.2 What happens when you mount `<GlassScroll />` in `layout.tsx`

**On the server (SSR):**

1. React renders `GlassScroll`. It returns two things: a `<style id="glass-scroll">` element
   containing the full stylesheet, and an empty overlay root
   `<div class="gs-root" aria-hidden data-overflow="false" data-visible="false">` with a track
   and thumb inside.
2. Because `data-overflow` is `"false"`, the CSS keeps the root at `opacity: 0`. The HTML that
   reaches the browser already contains the hidden bar and the styles. No flash, no layout shift.
3. The stylesheet also contains `html { scrollbar-width: none }` and the `::-webkit-scrollbar`
   hide for `html`, so the native page bar is gone from the very first paint, and with
   `scope="all"` the global native theme for nested containers is present too.
4. No effect runs, no `window` is touched. Rendering is pure.

**On the client (hydration):**

5. React hydrates and runs the component's effect. The effect calls
   `createGlassScroll(window, options)` from the core, passing the already-rendered root element.
6. The controller measures: viewport height, document scroll height, current scroll offset. It
   computes thumb size and position (section 2.3), writes them to the thumb's `style`, and sets
   `data-overflow="true"` if the page scrolls.
7. It registers with the shared registry (section 2.5), which attaches one `pointermove` listener
   to `document` and one `resize` listener to `window` if none exist yet. It attaches a passive
   `scroll` listener to `window`, a `ResizeObserver` to `document.body`, and pointer handlers to
   the thumb.
8. From here on nothing goes through React. Every scroll, resize, or pointer event goes straight
   to the controller, which writes to the DOM directly.

**On unmount** (route change in a framework that remounts the layout, or Strict Mode's
double-invoke in development): the effect cleanup calls `instance.destroy()`, which cancels any
pending animation frame, clears the hide timer, disconnects observers, removes every listener,
and deregisters from the registry. If it was the last instance, the registry drops its document
listeners too. Mount again and you get exactly one set of listeners, never two.

### 2.3 The maths

All of it derives from one measurement function, run on demand (never cached, because every input
can change without a scroll event: a resize, an image loading, a route swap).

```ts
const viewport  = target ? target.clientHeight : window.innerHeight
const content   = target ? target.scrollHeight : document.documentElement.scrollHeight
const maxScroll = content - viewport                       // total scrollable distance
const track     = target ? bar.clientHeight : viewport     // the channel the thumb runs in
const thumb     = clamp((viewport / content) * track, minThumbSize, track)
```

**Thumb size is proportional.** The thumb takes the same fraction of the track that the viewport
takes of the content. Worked example, a 3-screen page on a 900px-tall viewport:

| Quantity | Value |
| --- | --- |
| viewport | 900 |
| content | 2700 |
| track | 900 |
| thumb | 900 / 2700 × 900 = 300 |

On a 40-screen page the raw value would be 22px, so the `minThumbSize` floor (44px) kicks in and
gives a grabbable thumb. The upper clamp to `track` only matters when the track is shorter than
the minimum.

**Position maps onto travel, not track.**

```ts
const travel = track - thumb                                // how far the thumb can move
const y = (clamp(scrollTop, 0, maxScroll) / maxScroll) * travel
thumb.style.transform = `translate3d(0, ${y}px, 0)`
```

Using `travel` rather than `track` is what makes the thumb's *bottom* edge land on the track's
bottom edge when the page is fully scrolled. Same example, scrolled to the bottom:

| Quantity | Value |
| --- | --- |
| scrollTop | 1800 (= maxScroll) |
| travel | 900 − 300 = 600 |
| y | 1800 / 1800 × 600 = 600 |
| thumb spans | 600 to 900, exactly the track bottom |

The `clamp` on `scrollTop` absorbs rubber-band overscroll on iOS and macOS, where `scrollY` really
does go negative or past `maxScroll` for a moment. Without it the thumb would shoot past the ends
of the track during a bounce.

**Dragging is the same mapping run backwards.**

```ts
const delta = ((pointerY - dragStartY) / travel) * maxScroll
const next  = clamp(dragStartScroll + delta, 0, maxScroll)
scroller.scrollTo(next)
thumb.style.transform = `translate3d(0, ${(next / maxScroll) * travel}px, 0)`  // same frame
```

Pointer pixels convert to scroll pixels at the ratio `maxScroll / travel` (in the example, 3
scroll pixels per pointer pixel). Anchoring to where the drag *started* rather than accumulating
per-move deltas means rounding never drifts and clamping at the edges never "eats" travel. The
last line moves the thumb in the same event, before the resulting `scroll` event has even fired,
so it never trails the cursor.

**Horizontal** is the identical set of formulas with `clientWidth`, `scrollWidth`, `scrollLeft`,
`clientX`, and `translate3d(x, 0, 0)`. Both axes share one controller and one measurement pass.

### 2.4 The visibility state machine

The controller keeps three pieces of state, `hovering`, `dragging`, and `hideTimer`, and writes
the result into data attributes on the root that the CSS reads.

```
   scroll event ─────────┐
   pointer within        │      reveal():
   edgeReveal px of the  ├────► data-visible = "true"
   scroller's edge ──────┤      scheduleHide()
   mount (areas only) ───┘
                                     │  hideDelay ms with no new reveal
                                     │  AND not hovering AND not dragging
                                     ▼
                              data-visible = "false"      (CSS fades opacity to 0)

   thumb pointerenter  →  hovering = true,  cancel timer            (pinned visible)
   thumb pointerleave  →  hovering = false, scheduleHide()
   thumb pointerdown   →  dragging = true,  data-dragging = "true"  (pinned visible)
   pointerup / cancel  →  dragging = false, scheduleHide()
```

The CSS gate requires *both* attributes:

```css
.gs-root { opacity: 0; transition: opacity var(--gs-fade-duration) var(--gs-ease); }
.gs-root[data-overflow="true"][data-visible="true"] { opacity: 1; }
```

`data-overflow` is rewritten on every update from `maxScroll > 0`. A page that cannot scroll can
never show a bar no matter how the pointer moves, and a page that shrinks below one viewport
silently drops its bar with no separate teardown path. `autoHide={false}` simply never calls
`scheduleHide`, so the bar stays up whenever there is overflow.

### 2.5 Event wiring and coalescing

Every trigger funnels into one function:

```ts
const schedule = () => {
  if (frame) return
  frame = requestAnimationFrame(() => { frame = 0; update() })
}
```

A fast wheel spin fires dozens of `scroll` events between paints. The guard collapses them into
exactly one `update()` per painted frame. Resize and observer callbacks go through the same gate.

**Listeners are passive** where the spec allows (`scroll`, `pointermove`, `wheel`, `touchstart`).
That is a promise to the browser that we will never call `preventDefault()`, so it never waits on
us before scrolling.

**One document listener for every instance.** The edge-reveal feature needs to know where the
pointer is at all times. Rather than each `GlassScroll` and `GlassScrollArea` adding its own
`pointermove` listener, a tiny registry attaches one to `document` and one `resize` to `window`,
and calls each live controller's handler in turn. Ten areas on a page still cost one listener.
The registry removes its listeners when the last controller is destroyed.

**Observers catch changes that are not scroll events.** A `ResizeObserver` watches the target and
its direct children, because content growing *inside* a pane (a table loading rows, an accordion
opening) changes `scrollHeight` without changing the pane's own box. A `MutationObserver` on the
target's `childList` makes sure children added later by React are also observed. This fixes a
documented limitation of the original component, which snapshotted the child list at mount.

**Drag uses pointer capture** so the thumb keeps receiving events after the pointer leaves the 6px
pill, and attaches `pointermove`/`pointerup`/`pointercancel` to `window` so you can drag far
outside the browser content area and still control the scroll. `releasePointerCapture` is wrapped
in `try/catch` because the capture may already be gone after `pointercancel`.

### 2.6 Why it stays fast

- **No React state on the scroll path.** The component has no `useState`. If scroll position
  lived in React state it would mean a render per frame, reconciliation, and garbage.
- **Compositor-only writes.** The thumb moves via `transform: translate3d`, which the compositor
  handles without layout or paint. `top`/`left` are never touched. `will-change: transform` keeps
  it on its own layer.
- **No CSS transitions on JS-owned properties.** `transform`, `height`, and `width` are excluded
  from every `transition` list. A transition on them would interpolate toward a target that has
  already moved, producing a thumb that permanently lags the scroll.
- **The overlay root is inert.** `pointer-events: none` and `contain: strict` mean it never
  intercepts a click and never participates in the page's layout. Only the thumb re-enables
  pointer events.
- **Reads before writes.** `update()` reads every measurement first, then writes, so it never
  forces the browser into a synchronous layout mid-function.

### 2.7 How styles reach the page without a CSS import

The component renders a `<style>` element as part of its own output:

```tsx
<style id="glass-scroll" nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />
```

Because it is ordinary React output, it is present in the server-rendered HTML, hydrates
normally, and needs no bundler CSS support. This avoids the two classic failure modes of
library CSS: "I forgot the import" and "Next.js will not let me import CSS from node_modules in
this file".

Deduplication: identical stylesheets are hashed to one id, and a small module-level registry
hands ownership of that id to the first component that mounts. Everyone else renders nothing, and
if the owner unmounts, ownership passes to the next in line so the rules never vanish while
something still needs them. Before hydration nobody has claimed anything, so every instance
renders the tag and the server HTML matches exactly.

React 19's hoistable `<style precedence>` would deduplicate this for free, and the package
deliberately does not use it: hoisted styles are never removed, so toggling a theme or setting
`disabled` would leave stale rules behind in `<head>`, and the `nonce` is not forwarded.

The stylesheet is built at runtime from three inputs: the base CSS string, the `scope`
(whether to include the global native theme), and the `exclude`/`hideNative` selectors. That is
why it is a template string in `styles.ts` rather than a static file. The static `styles.css`
export is generated from the same string at build time with the default options, for people who
set `injectStyles={false}` and prefer to own their CSS pipeline.

`nonce` exists for Content Security Policy. Sites that forbid inline styles can pass their
per-request nonce and the `<style>` tag carries it.

### 2.8 The theming pipeline

```
preset ("glass")            →  full set of --gs-* defaults, baked into the stylesheet
theme prop ({ thumbBg })    →  inline style on .gs-root: --gs-thumb-bg: ...
                            →  and, for the native theme, a generated :root { --gs-thumb-bg: ... }
your CSS                    →  overrides any variable, anywhere, by normal cascade
classNames / styles         →  reach individual parts for anything variables cannot express
```

The overlay's CSS reads only variables:

```css
.gs-thumb {
  width: var(--gs-thumb-size);
  right: var(--gs-edge-offset);
  border-radius: var(--gs-thumb-radius);
  background: var(--gs-thumb-bg);
  box-shadow: var(--gs-thumb-shadow);
  backdrop-filter: blur(var(--gs-thumb-blur));
}
.gs-thumb:hover, .gs-root[data-dragging="true"] .gs-thumb {
  width: var(--gs-thumb-size-hover);
  right: calc(var(--gs-edge-offset) - (var(--gs-thumb-size-hover) - var(--gs-thumb-size)) / 2);
}
```

The hover rule grows the thumb and shifts `right` by half the growth, so its outer edge stays
fixed and it grows toward the content instead of jumping sideways.

Dark mode redefines the colour and shadow variables inside both a
`@media (prefers-color-scheme: dark)` block and a `darkSelector` block (`.dark`,
`[data-theme="dark"]` by default). `colorScheme="dark"` forces the dark values unconditionally;
`"light"` omits both blocks.

### 2.9 `GlassScrollArea` and the host contract

An element-mode overlay has three requirements the original app had to satisfy by hand: a
positioned ancestor for the absolute overlay to pin to, a hidden native bar on the scroller so it
is not double-drawn, and `tabIndex={0}` so a `<div>` stays keyboard-scrollable. `GlassScrollArea`
renders all three:

```tsx
<div class="gs-area" style="position: relative; overflow: hidden">   // your className/style land here
  <div class="gs-scroller" tabindex="0" style="overflow: auto; scrollbar-width: none">
    {children}
  </div>
  <div class="gs-root gs-root--local" aria-hidden ...>                // the overlay, a sibling
</div>
```

Its effect is keyed on the scroller *element* obtained from a callback ref, not on the ref
object, so if the element is ever swapped the controller rebinds. The area reads `preset`,
`theme`, and timing from the nearest `GlassScroll` through context, so one root configuration
covers every pane unless a pane overrides it.

### 2.10 Why one build works in every React framework

The component makes only four assumptions, and all of them hold everywhere React runs in a browser:

1. Rendering may happen without a DOM (SSR). Handled: no browser API is touched during render.
2. Effects run only in a browser. Handled: all measurement and listeners live in `useEffect`.
3. Effects may run twice in development (Strict Mode). Handled: `destroy()` is complete and
   `create` is idempotent.
4. The file may be imported from a server component. Handled: the `"use client"` banner.

Nothing depends on a router, a data layer, a CSS pipeline, or a specific bundler. The
`peerDependencies` range accepts React 18 and 19, and the only browser features used
(`ResizeObserver`, `MutationObserver`, Pointer Events, `requestAnimationFrame`) have been in
every evergreen browser for years. Environments without a `document` (React Native, Deno SSR
tests) get a component that renders its root and does nothing, never a crash.

### 2.11 Known limits going in

- **Nested containers get the native theme, not the overlay.** That is a deliberate choice (see
  README section 5). Wrap a pane in `GlassScrollArea` when it needs the overlay.
- **Touch has no hover-reveal.** The bar appears on scroll and fades after `hideDelay`, matching
  native mobile behaviour.
- **`backdrop-filter` is not universal.** Where it is unsupported the thumb is simply not blurred;
  everything else works.
- **Forced-colours mode disables the overlay** and restores the native bar, because translucent
  colours are meaningless there.
- **Track click is off by default.** Making the track interactive means it can intercept clicks
  on content under it, so `trackClick` defaults to `"none"` and only activates while the bar is
  visible when turned on.
