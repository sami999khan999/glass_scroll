# glass-scroll

> A glass overlay scrollbar for React. Drop one component into your root layout and every
> scrollbar on the site becomes a translucent, blurred pill that fades in when you need it and
> reserves **zero** layout width. TypeScript-first, framework-agnostic, fully themeable.

**Status:** implemented and verified, not yet published. 60 unit tests and 36 end-to-end tests
pass on Chromium, Firefox and WebKit against a real Next.js production build. Every milestone in
section 12 is done except the final `npm publish`, which is yours to run.
See [`HOW_IT_WORKS.md`](./docs/HOW_IT_WORKS.md) for a plain-language explanation of npm packages
and of how this one works internally, and [`CUSTOM_SCROLLBAR.md`](./docs/CUSTOM_SCROLLBAR.md) for
the original in-app implementation this package is extracted from.

---

## Table of contents

1. [Why](#1-why)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Quick start](#3-quick-start)
4. [Public API](#4-public-api)
5. [Scope modes](#5-scope-modes)
6. [Theming](#6-theming)
7. [Architecture](#7-architecture)
8. [Performance rules](#8-performance-rules)
9. [Accessibility](#9-accessibility)
10. [Framework compatibility](#10-framework-compatibility)
11. [Repository layout and tooling](#11-repository-layout-and-tooling)
12. [Milestones](#12-milestones)
13. [Testing strategy](#13-testing-strategy)
14. [Publishing checklist](#14-publishing-checklist)
15. [Roadmap](#15-roadmap)
16. [Open questions](#16-open-questions)

---

## 1. Why

Native scrollbars have two problems on a modern, full-bleed site:

1. **They reserve a gutter.** On Windows and on macOS with "always show scrollbars", the page
   scrollbar takes 10 to 17px of layout width. A short page that grows past one viewport shifts
   every centred element sideways; `100vw` elements overflow; `100dvh` heroes are off-centre.
2. **They can't be styled consistently.** `::-webkit-scrollbar` works in Chromium and Safari,
   `scrollbar-width`/`scrollbar-color` in Firefox, and neither gives you blur, shadows, hover
   growth, or auto-hide on desktop.

`glass-scroll` replaces the page scrollbar with a JavaScript-positioned overlay thumb that lives
*above* the content instead of *beside* it, and re-themes every nested scrollbar with CSS so the
whole site reads as one material. The result looks like the macOS overlay scrollbar, but on every
platform, with a frosted-glass finish, and with every visual property under your control.

## 2. Goals and non-goals

### Goals

- **One-line install.** `<GlassScroll />` in `app/layout.tsx` (or `App.tsx`, or the root route) and
  the whole site is covered. No CSS import required, no provider wrapping, no config file.
- **Works in every React framework.** Next.js (App and Pages Router), Remix / React Router,
  Vite + React, Gatsby, Astro islands, Create React App, Expo web. Server-side rendering and React
  Server Components are first-class, not afterthoughts.
- **Site-wide or page-only.** A `scope` prop chooses between re-skinning every scrollbar on the
  site or only the main document one.
- **Both axes.** Vertical and horizontal overlays, each independently switchable.
- **Fully customisable, good by default.** Every colour, size, radius, shadow, blur, timing and
  z-index is a CSS custom property you can override, a `theme` prop you can pass, or a class you
  can target. Out of the box it looks finished in light and dark mode.
- **Performant.** No React state on the scroll path, one `requestAnimationFrame` per painted frame,
  passive listeners, compositor-only transforms, one shared document listener for all instances.
- **Accessible.** Keyboard scrolling preserved, reduced-motion respected, forced-colours mode
  falls back to native bars, overlay hidden from assistive tech.
- **Small.** Under 5 kB for the core and under 7 kB with the React layer, minified and brotlied.
- **Strict TypeScript.** Exhaustive prop types, exported theme and option types, no `any`.

### Non-goals (for 1.0)

- Replacing scrolling itself. We never intercept wheel or touch scrolling, never implement
  smooth-scroll or momentum. The browser scrolls; we only draw the thumb.
- Virtualisation, scroll-linked animations, or scroll-spy. Other libraries do those.
- Non-React adapters shipped in the box. The core is framework-free so they *can* be written,
  but Vue/Svelte/vanilla wrappers are post-1.0.

## 3. Quick start

```bash
npm install glass-scroll
# or: pnpm add glass-scroll / yarn add glass-scroll / bun add glass-scroll
```

### Next.js (App Router)

```tsx
// app/layout.tsx
import { GlassScroll } from 'glass-scroll'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlassScroll />
      </body>
    </html>
  )
}
```

`GlassScroll` is a client component (it carries its own `"use client"` directive), so it is safe
to import into a server-component layout. It renders its styles inline, so nothing flashes on the
first server-rendered paint.

### Next.js (Pages Router), Vite, CRA, Gatsby

```tsx
// pages/_app.tsx  |  src/App.tsx  |  gatsby-browser.js wrapRootElement
import { GlassScroll } from 'glass-scroll'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <GlassScroll />
    </>
  )
}
```

### Remix / React Router framework mode

```tsx
// app/root.tsx
import { GlassScroll } from 'glass-scroll'

export default function App() {
  return (
    <html lang="en">
      <head><Meta /><Links /></head>
      <body>
        <Outlet />
        <GlassScroll />
        <Scripts />
      </body>
    </html>
  )
}
```

### Astro

```astro
---
import { GlassScroll } from 'glass-scroll'
---
<GlassScroll client:load />
```

### Only the page, not nested containers

```tsx
<GlassScroll scope="document" />
```

### A specific scrollable pane

```tsx
import { GlassScrollArea } from 'glass-scroll'

<GlassScrollArea className="h-96 rounded-xl border">
  {longContent}
</GlassScrollArea>
```

### Theming in two lines

```tsx
<GlassScroll
  preset="glass"
  theme={{ thumbBg: 'rgba(99, 102, 241, .55)', thumbSize: 8 }}
/>
```

## 4. Public API

The package has one default entry (`glass-scroll`, React) and one secondary entry
(`glass-scroll/core`, framework-free). A stylesheet is also exported for people who prefer a
CSS import over inline injection.

### `<GlassScroll />`

Mounted once, anywhere in the tree. Self-closing; wraps nothing. Controls the **document**
scrollbar and, when `scope="all"`, the global native-scrollbar theme.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `scope` | `'all' \| 'document'` | `'all'` | `'all'` hides the native page bar, mounts the overlay, **and** re-themes every nested scrollbar via CSS. `'document'` touches only the page bar. See [§5](#5-scope-modes). |
| `axis` | `'y' \| 'x' \| 'both'` | `'both'` | Which overlay bars to draw for the document. Horizontal is only shown when the document actually overflows horizontally. |
| `preset` | `'glass' \| 'minimal' \| 'solid'` | `'glass'` | A named bundle of theme values. See [§6](#6-theming). |
| `theme` | `Partial<GlassScrollTheme>` | `{}` | Per-property overrides applied on top of the preset. Converted to CSS custom properties. |
| `colorScheme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `'auto'` follows `prefers-color-scheme` **and** `darkSelector`. Forcing a value ignores both. |
| `darkSelector` | `string` | `'.dark, [data-theme="dark"]'` | Selector on `html`/`body` that switches to the dark palette when `colorScheme="auto"`. Matches Tailwind, next-themes, shadcn defaults. |
| `autoHide` | `boolean` | `true` | Fade the bar out after `hideDelay` ms of inactivity. `false` keeps it always visible while content overflows. |
| `hideDelay` | `number` | `1100` | Milliseconds of quiet before fading. |
| `edgeReveal` | `number` | `44` | Pointer distance (px) from the scroller edge that reveals the bar without scrolling. `0` disables edge reveal. |
| `minThumbSize` | `number` | `44` | Minimum thumb length in px so very long pages still give a grabbable target. |
| `trackClick` | `'none' \| 'page' \| 'jump'` | `'none'` | Behaviour when clicking the empty track. `'none'` keeps the track inert so it never eats clicks on content beneath it. `'page'` scrolls one viewport; `'jump'` scrolls to the clicked position. Both make the track interactive **only while the bar is visible**. |
| `exclude` | `string` | `'.no-glass, [data-glass-scroll="off"]'` | In `scope="all"`, elements matching this selector keep the browser default scrollbar. Useful for third-party widgets. |
| `hideNative` | `string` | `'.no-scrollbar, [data-glass-scroll="hidden"]'` | Selector whose native bar is hidden entirely (no overlay, no theme). For snap carousels and tab strips. |
| `classNames` | `{ root?, track?, thumb?, trackX?, thumbX? }` | `{}` | Extra classes per part. |
| `styles` | `{ root?, track?, thumb?, trackX?, thumbX? }` | `{}` | Inline style objects per part. |
| `injectStyles` | `boolean` | `true` | Render the stylesheet inline in a deduplicated `<style>` tag. Set `false` if you import `glass-scroll/styles.css` yourself. |
| `nonce` | `string` | `undefined` | CSP nonce forwarded to the injected `<style>` tag. |
| `zIndex` | `number` | `9998` | Overlay stacking level. Shorthand for `theme.zIndex`. |
| `disabled` | `boolean` | `false` | Unmounts the overlay and restores the native page bar without removing the component from the tree. |
| `onVisibilityChange` | `(visible: boolean) => void` | `undefined` | Fires when the bar fades in or out. |

### `<GlassScrollArea />`

Wraps any block of content and turns it into a scroll container with its own overlay. Handles
the entire host contract from the original design (positioned wrapper, hidden native bar,
`tabIndex=0`) so the consumer does not have to know it exists.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `as` | `keyof JSX.IntrinsicElements` | `'div'` | Element type for the scroller. |
| `axis` | `'y' \| 'x' \| 'both'` | `'y'` | Which overlays to draw. |
| `className` / `style` | | | Applied to the **outer** positioned wrapper (size it here). |
| `scrollerProps` | `HTMLAttributes` | `{}` | Spread onto the inner scroller (e.g. `onScroll`, `id`, `role`). |
| `scrollerRef` | `Ref<HTMLElement>` | | Access the inner scroller element. |
| `revealOnMount` | `boolean` | `true` | Flash the bar once so scrollability is discoverable. |
| `inheritTheme` | `boolean` | `true` | Read `preset`/`theme`/timing from the nearest `<GlassScroll>` via context. Explicit props override. |
| …every visual and timing prop from `GlassScroll` except `scope`, `exclude`, `hideNative`, `injectStyles` | | | Same meaning, local to this area. |

### `useGlassScroll(ref?)`

```ts
const { reveal, update, scrollTo, isOverflowing } = useGlassScroll(areaRef)
```

Imperative handle for the document overlay (no argument) or a specific area (pass its ref).
`update()` forces a re-measure, useful after you mutate the DOM outside React. `scrollTo`
proxies to the underlying scroller with `behavior: 'instant'` by default.

### `glass-scroll/core`

```ts
import { createGlassScroll } from 'glass-scroll/core'

const instance = createGlassScroll(window, { axis: 'y', hideDelay: 800 })
instance.destroy()
```

The React-free engine. `createGlassScroll(target, options)` builds the overlay DOM, attaches
listeners, and returns `{ update, reveal, destroy, setOptions }`. Everything the React layer does
is a thin wrapper over this, so it is the foundation for future Vue/Svelte/vanilla adapters.

### Also exported

| Export | Purpose |
| --- | --- |
| `glassScrollCSS: string` | The full stylesheet as a string, for custom injection. |
| `presets: Record<PresetName, GlassScrollTheme>` | The preset theme objects, for extension. |
| `defineTheme(theme): GlassScrollTheme` | Identity helper that gives autocompletion. |
| `types` | `GlassScrollProps`, `GlassScrollAreaProps`, `GlassScrollTheme`, `GlassScrollOptions`, `GlassScrollInstance`, `Axis`, `Scope`, `PresetName`. |
| `glass-scroll/styles.css` | Static stylesheet for `injectStyles={false}` users. |

## 5. Scope modes

Two independent rendering systems exist, exactly as in the original app. The `scope` prop chooses
how many of them are active.

```
                                       scope="all"     scope="document"
html { scrollbar-width: none }             yes              yes
document overlay (JS thumb)                yes              yes
* { scrollbar-width: thin; ... }           yes              no  (nested bars untouched)
*::-webkit-scrollbar-* themed rules        yes              no
`exclude` selector honoured                yes              n/a
`hideNative` selector honoured             yes              yes
```

**Why hybrid and not "JS overlay on everything".** A nested container (dropdown, dialog, table
body) is usually small, short-lived, and rendered by a library you do not control. A themed native
bar there costs zero JavaScript, needs no positioned ancestor, cannot break the library's
`overflow` handling, and already looks like the overlay thumb because both use the same width,
radius, colour and blur. The overlay is reserved for the page, where the reserved gutter actually
hurts, and for any pane you deliberately wrap in `<GlassScrollArea>`.

**How the native theme matches the overlay.** Two mechanisms are emitted and each engine picks
one on its own. Where `::-webkit-scrollbar` is the only option (older Safari and Chromium) the
rule reserves a 10px gutter but paints a 6px pill inside it, using a 2px transparent border plus
`background-clip: padding-box` — visually identical to the overlay thumb, blur and hairline
included. Where the standard `scrollbar-width`/`scrollbar-color` properties are understood
(Firefox, Chromium 121+, Safari 18.2+) those win, because Chromium disables custom
`::-webkit-scrollbar` painting as soon as they are set; the result is a thin two-tone bar in the
same colours, without the blur or the hairline. That is a limit of the platform API, not a
choice — and it is why the overlay, not the native bar, is what the page itself uses.

Note for contributors: do **not** gate these on `@supports selector(::-webkit-scrollbar)`.
Firefox parses that selector and reports it as supported while painting nothing from it, which
would leave Firefox with no theming at all.

**Both properties are inherited**, which drives three rules in the stylesheet that are easy to
get wrong and are locked in by tests:

1. Hiding the document bar with `html { scrollbar-width: none }` would cascade `none` into every
   nested scroll container, so the sheet immediately restores the initial value below the root.
2. Leaving an element out of the themed selector does not stop it inheriting the theme from its
   ancestors, so `exclude` also emits an explicit reset for those elements and their subtrees.
3. `hideNative` is emitted *after* the theme. Every rule is zero-specificity `:where()`, so
   source order decides, and an explicit request to hide a bar must beat the blanket theme.

**Opting individual elements out.** In `scope="all"`, anything matching `exclude` keeps the
browser default bar (for third-party editors, maps, embeds), and anything matching `hideNative`
hides its bar entirely (for snap carousels and tab strips that rely on gestures).

## 6. Theming

Every visual decision is a CSS custom property on the overlay root and, for the native theme, on
`:root`. Three layers stack, later wins:

1. **Preset** (`preset` prop) sets all variables.
2. **`theme` prop** overrides individual variables via inline `style` on the overlay root and a
   scoped `:root` rule for the native theme.
3. **Your own CSS** can override any `--gs-*` variable anywhere, and `classNames`/`styles` reach
   the individual parts.

### Variables

| Variable | Theme key | Default (glass, light) | Notes |
| --- | --- | --- | --- |
| `--gs-thumb-bg` | `thumbBg` | `rgba(130,132,140,.55)` | Resting fill |
| `--gs-thumb-bg-hover` | `thumbBgHover` | `rgba(130,132,140,.75)` | Hover fill |
| `--gs-thumb-bg-active` | `thumbBgActive` | `rgba(130,132,140,.9)` | Dragging fill |
| `--gs-thumb-size` | `thumbSize` | `6px` | Thumb thickness |
| `--gs-thumb-size-hover` | `thumbSizeHover` | `8px` | Grows toward content, edge stays put |
| `--gs-thumb-radius` | `thumbRadius` | `9999px` | |
| `--gs-thumb-shadow` | `thumbShadow` | `inset 0 0 0 1px rgba(255,255,255,.35), 0 1px 3px rgba(0,0,0,.18)` | Hairline + drop |
| `--gs-thumb-blur` | `thumbBlur` | `4px` | `backdrop-filter` amount. `0` disables the filter. |
| `--gs-track-bg` | `trackBg` | `transparent` | Painting it reintroduces a visual gutter; off by default |
| `--gs-track-size` | `trackSize` | `12px` | Width of the inert strip the thumb runs in |
| `--gs-edge-offset` | `edgeOffset` | `3px` | Gap between thumb and viewport edge |
| `--gs-z-index` | `zIndex` | `9998` | Under modals/toasts, above content |
| `--gs-fade-duration` | `fadeDuration` | `300ms` | Fade in/out |
| `--gs-grow-duration` | `growDuration` | `180ms` | Hover growth |
| `--gs-ease` | `ease` | `ease` | Timing function for both |
| `--gs-native-gutter` | `nativeGutter` | `10px` | Gutter reserved by themed native bars |
| `--gs-*-dark` | `dark.*` | light pill on dark: `rgba(205,207,217,.32)` etc. | Every colour/shadow variable has a dark twin |

`GlassScrollTheme` mirrors this table as a typed object with a nested `dark` block. Numbers are
treated as px.

### Presets

| Preset | Look |
| --- | --- |
| `glass` | Translucent neutral pill, hairline highlight, 4px backdrop blur, grows on hover. The default. |
| `minimal` | Thinner (4px), no blur, no shadow, lower opacity. Editorial. |
| `solid` | Opaque accent-coloured thumb, no blur, faint track. Familiar desktop feel. |

Custom presets are just objects: `<GlassScroll theme={defineTheme({ ...presets.glass, thumbBg: '…' })} />`.

### Dark mode

`colorScheme="auto"` emits both a `@media (prefers-color-scheme: dark)` block and a
`darkSelector` block, so it works with system preference and with class-based toggles
(Tailwind `.dark`, next-themes `[data-theme]`). `colorScheme="dark"` or `"light"` forces one
palette.

### Escape hatches

`classNames` and `styles` target `root`, `track`, `thumb`, `trackX`, `thumbX`. The DOM is stable
and documented (`.gs-root > .gs-track > .gs-thumb`, plus `.gs-track--x > .gs-thumb--x`), so plain
CSS works too. Data attributes on the root expose state for styling: `data-overflow`,
`data-visible`, `data-dragging`, `data-axis`, `data-hovering`.

## 7. Architecture

```
src/
  core/                        framework-agnostic; imports nothing from React
    controller.ts              ScrollbarController: owns one target (window or element), one or
                               two axes, metrics, update(), drag, visibility state machine
    metrics.ts                 pure: thumbSize(), thumbOffset(), dragToScroll(), clamp()
    registry.ts                one shared document pointermove + window resize listener,
                               fanned out to every live controller (N instances, 1 listener)
    observers.ts               ResizeObserver on target + children, MutationObserver on
                               childList so later-added children get observed
    dom.ts                     builds/destroys the overlay DOM, writes data-attributes
    styles.ts                  CSS as a template string + variable defaults + presets +
                               buildNativeThemeCSS(exclude, hideNative)
    types.ts
  react/
    GlassScroll.tsx            "use client". Renders <style> (dedup by id, nonce) + overlay root;
                               useEffect -> createGlassScroll(window)
    GlassScrollArea.tsx        wrapper + scroller + overlay sibling; useEffect keyed on the
                               scroller ELEMENT, not the ref object
    GlassScrollContext.ts      theme/timing inheritance root -> areas
    useGlassScroll.ts
    useIsomorphicLayoutEffect.ts
  index.ts                     React entry
  core.ts                      framework-free entry
styles.css                     generated from core/styles.ts by the build
```

### Data flow

```
 scroll / resize / DOM mutation / pointer near edge
                    |
                    v
        registry.ts (one document listener)
                    |  fan-out
                    v
        controller.schedule()  --> rAF (coalesced: max 1 update per frame)
                    |
                    v
        controller.update()
          metrics()   --> thumb size + offset per axis
          dom.write() --> thumb.style.transform / height / width
                      --> root.dataset.overflow / visible / dragging
                    |
                    v
        CSS reacts to data-attributes (opacity, hover growth, colours)
```

React's job ends at mount: it renders a `<style>` and an empty overlay root, then hands the
element to the controller. No React state changes on the scroll path, ever.

## 8. Performance rules

These are constraints the implementation must satisfy, and each gets a test or a lint guard.

- **No React state on the hot path.** `useState`/`setState` is forbidden inside the controller
  and in any code reachable from a scroll event.
- **One `update()` per painted frame.** All triggers call `schedule()`, which is a no-op if a
  frame is already pending.
- **Passive listeners** for `scroll`, `pointermove`, `touchstart`, `wheel`.
- **Compositor-only writes.** Thumb position via `transform: translate3d`; `will-change: transform`.
  `top`/`left` are never written.
- **No transitions on JS-owned properties.** `transform`, `height`, `width` are excluded from
  every `transition` list, so CSS never fights per-frame writes.
- **One document listener, N instances.** `registry.ts` attaches `pointermove` and `resize` once
  and dispatches to controllers. Mounting ten areas does not add ten listeners.
- **`contain: strict` and `pointer-events: none`** on the overlay root so it never triggers
  layout in the page or intercepts clicks; only the thumb re-enables pointer events.
- **Layout reads batched before writes** inside `update()` to avoid forced synchronous layout.
- **Clamp every input.** `scrollTop` is clamped for rubber-band overscroll; thumb size is
  clamped to `[minThumbSize, track]`.
- **Zero dependencies.** Runtime `dependencies` stays empty; React is a peer.
- **Size budget** enforced by `size-limit` in CI. The measured figures, minified and brotlied:

| Entry | Size | Budget |
| --- | --- | --- |
| `glass-scroll/core` | 4.62 kB | 5 kB |
| `glass-scroll` (React) | 6.54 kB | 7 kB |

## 9. Accessibility

- The overlay is `aria-hidden="true"`. It duplicates scroll state the browser already exposes.
- The real scroll container is untouched, so keyboard, screen-reader and find-in-page scrolling
  all still work. `GlassScrollArea` sets `tabIndex={0}` on the scroller so a `<div>` pane remains
  keyboard-scrollable; `scrollerProps.tabIndex` can override it.
- `@media (prefers-reduced-motion: reduce)` removes fade and growth transitions. Thumb *movement*
  is not an animation (it tracks the user's own scroll) and is unaffected.
- `@media (forced-colors: active)` (Windows High Contrast) hides the overlay and restores the
  native page scrollbar, because the thumb's translucent colours would become invisible.
- Touch devices get native-like behaviour: bar appears on scroll, fades after `hideDelay`;
  no hover-reveal. Areas flash once on mount so scrollability is discoverable.
- `trackClick="page"`/`"jump"` only makes the track interactive while the bar is visible, so it
  never silently swallows a tap on content.

## 10. Framework compatibility

| Framework | Mount point | Notes |
| --- | --- | --- |
| Next.js App Router | `app/layout.tsx` | `"use client"` directive is baked into the bundle; safe to import from a server component. Inline styles avoid the CSS-in-node_modules ordering issues. |
| Next.js Pages Router | `pages/_app.tsx` | |
| Remix / React Router v7 | `app/root.tsx` | Place before `<Scripts />`. |
| Vite + React, CRA | `src/App.tsx` or `main.tsx` | |
| Gatsby | `gatsby-browser.js` + `gatsby-ssr.js` `wrapRootElement` | |
| Astro | any `.astro` with `client:load` | React integration required. |
| Expo (web) | root layout | Native platforms render nothing; the component no-ops when `document` is undefined. |
| React 18 | supported | Effects only; no `useSyncExternalStore` needed. |
| React 19 | supported | The stylesheet stays a normal element rather than a hoisted `<style precedence>`, so it is removed on unmount and carries a `nonce`. |
| Strict Mode | supported | Effects mount/unmount/mount cleanly; the controller is idempotent. |

Requirements: React 18 or newer, browsers with `ResizeObserver` and Pointer Events (all evergreen
browsers, Safari 13.1 or newer). Without `backdrop-filter` the thumb is simply not blurred.

## 11. Repository layout and tooling

```
glass_scroll-npm/
  package.json               name: glass-scroll, type: module, exports map, peerDeps
  tsconfig.json              strict, moduleResolution: bundler, jsx: react-jsx
  tsup.config.ts             entries: src/index.ts, src/core.ts -> esm + cjs + d.ts, banner "use client"
  vitest.config.ts           jsdom environment
  playwright.config.ts       runs examples/next-app
  eslint.config.js           typescript-eslint, react-hooks, jsx-a11y
  .prettierrc
  .size-limit.json
  .changeset/
  .github/workflows/ci.yml   lint + typecheck + unit + build + size on PR
  .github/workflows/release.yml  changesets -> npm publish with provenance
  src/                       see section 7
  tests/
    unit/                    metrics, controller state machine, styles builder
    e2e/                     Playwright specs
  examples/
    next-app/                Next.js App Router, layout.tsx mount, long page + areas + dark toggle
    vite-react/              minimal Vite mount
  README.md                  this file (will become user docs at 1.0)
  docs/
    HOW_IT_WORKS.md          explainer
    CUSTOM_SCROLLBAR.md      original reference implementation
  CHANGELOG.md               generated by changesets
  LICENSE                    MIT
```

Package manager: `pnpm` with a workspace so `examples/*` consume the package via
`workspace:*` and always test the real build output.

### `package.json` shape

```jsonc
{
  "name": "glass-scroll",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "styles.css"],
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".":            { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./core":       { "types": "./dist/core.d.ts",  "import": "./dist/core.js",  "require": "./dist/core.cjs" },
    "./styles.css": "./styles.css",
    "./package.json": "./package.json"
  },
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
  "peerDependenciesMeta": { "react": { "optional": true }, "react-dom": { "optional": true } },
  "engines": { "node": ">=18" }
}
```

## 12. Milestones

Each milestone is a pull-request-sized unit with acceptance criteria.

| # | Milestone | Status | Done when |
| --- | --- | --- | --- |
| 0 | **Scaffold** | Done | `pnpm build` emits ESM + CJS + d.ts for both entries; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass on an empty suite; CI green; `examples/next-app` boots and imports the package. |
| 1 | **Core controller, Y axis** | Done | `createGlassScroll(window)` and `createGlassScroll(element)` draw a correct thumb; drag, edge reveal, auto-hide, overscroll clamp all work in the Vite example; `metrics.ts` has 100% unit coverage; Strict Mode double-mount leaves one listener set. |
| 2 | **`<GlassScroll />` document mode** | Done | Mounted in `examples/next-app/app/layout.tsx`; SSR output has no `window` access and the overlay is transparent until hydration; inline `<style>` renders once even with two instances; `nonce` forwarded; `disabled` restores native bar. |
| 3 | **`scope="all"`** | Done | Nested containers in the example (dialog, dropdown, table) show the themed native bar; `exclude` and `hideNative` selectors work; the native pill visually matches the overlay pill in a screenshot test. |
| 4 | **`<GlassScrollArea />`** | Done | Wraps content with zero host setup; inherits theme via context; keyboard scroll works; later-added children trigger re-measure (MutationObserver); swapping the scroller element re-binds. |
| 5 | **Horizontal axis** | Done | `axis="x"` and `"both"` on document and areas; corner handling when both bars visible; horizontal drag; RTL sanity check. |
| 6 | **Theming** | Done | All variables in section 6 wired; three presets; `theme` prop to CSS variables; dark mode via media query and `darkSelector`; `classNames`/`styles`; typed `GlassScrollTheme`. |
| 7 | **Accessibility and edge cases** | Done | Reduced motion, forced colours, touch behaviour, `trackClick` modes, `onVisibilityChange`, `useGlassScroll` handle; no-op on non-DOM environments. |
| 8 | **Release 0.1.0** | Done, less the publish | Playwright e2e green on Chromium, Firefox, WebKit; size budget met; README rewritten as user docs; CHANGELOG; `npm publish --provenance` from CI on tag. |

## 13. Testing strategy

- **Unit (Vitest + jsdom).** `metrics.ts` pure functions with table-driven cases (proportional
  thumb, min clamp, degenerate track smaller than min, travel mapping, drag inverse mapping
  round-trips). Controller state machine: reveal, hide timer, hover pins, drag pins, release
  re-arms. `styles.ts` builder: emits expected selectors for `scope`, `exclude`, `hideNative`,
  dark mode.
- **Component (Vitest + Testing Library).** `<GlassScroll>` renders one `<style>` for two
  instances, forwards `nonce`, exposes data-attributes, cleans up on unmount, survives Strict Mode.
- **E2E (Playwright).** Against `examples/next-app`: SSR HTML contains the overlay with
  `data-overflow="false"`; after hydration on a long page the thumb height matches
  `viewport / scrollHeight * track`; scrolling to bottom aligns thumb bottom with track bottom;
  dragging the thumb scrolls the page; nested dialog shows themed native bar; `scope="document"`
  leaves nested bars default; reduced-motion emulation removes transitions; dark class toggles
  palette. Visual regression screenshots for presets in light and dark.
- **Type tests.** `expect-type` for the public prop types and theme object.

### What runs today

`pnpm test` runs 60 unit tests; `pnpm test:e2e` runs 12 specs on each of Chromium, Firefox and
WebKit (36 runs) against a real `next build` of `examples/next-app`.

Two engine quirks are worth knowing before touching these tests:

- **Browsers run one at a time.** `workers` is pinned to 1 locally and 2 in CI, because running
  all three browser processes concurrently crashes WebKit on Windows.
- **Firefox does not expose a queryable computed `scrollbar-width`** — even an inline declaration
  reads back as the root's value — so the nested-scrollbar spec detects that and skips the
  computed-style assertions there. The rules themselves are asserted in the unit suite.
- **Scroll before hydration is a lost event.** Specs wait for `data-overflow` on the overlay,
  which the first `update()` writes, before scrolling; otherwise the listener is not yet attached.
- `mouse.wheel` is not honoured reliably by WebKit's driver, so the specs drive the scroller
  directly. The code path under test is the same.

## 14. Publishing checklist

1. Confirm `glass-scroll` is available on npm (`npm view glass-scroll` should 404). If taken,
   fall back to a scoped name and update this document.
2. `pnpm changeset`, version bump, CHANGELOG entry.
3. CI green: lint, typecheck, unit, e2e, build, size-limit.
4. `pnpm pack` and inspect the tarball: only `dist/`, `styles.css`, `README.md`, `LICENSE`,
   `package.json`.
5. Smoke-test the tarball in a fresh `create-next-app` via `pnpm add ./glass-scroll-x.y.z.tgz`.
6. Tag; the release workflow publishes with `--provenance --access public`.
7. Verify on npm that `exports`, `types`, and the README render correctly.

## 15. Roadmap

- **1.x:** `trackClick` modes polished, `useGlassScroll` scroll-to-with-reveal, RTL mirroring,
  `renderThumb` slot for fully custom markup, scroll-progress CSS variable (`--gs-progress`)
  for reading-progress bars.
- **2.x candidates:** `@glass-scroll/vue`, `@glass-scroll/svelte`, vanilla web component;
  nested-overlay auto-detection as an opt-in `scope="overlay-all"` for teams that want the JS
  overlay on every container.

## 16. Open questions

- Should `scope` default to `'all'` (site-wide, more opinionated) or `'document'` (least
  surprise)? Plan says `'all'` because "override every scrollbar" is the headline feature.
- Track painting: keep `--gs-track-bg: transparent` as the default for all presets, or let
  `solid` show a faint track? Plan says `solid` shows one.
- Should `GlassScrollArea` also accept a viewport-ref style API for virtualised lists that
  need the scroller element? Covered by `scrollerRef`; confirm during Milestone 4.
