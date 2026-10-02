# glass-scroll

## 0.2.0

### Minor Changes

- `themeScope` on `<GlassScroll />` and `buildCSS()`. A theme colour written as `var(--token)`
  was resolved once, on `:root`, so a part of the page with its own tokens (a light panel on a dark
  page, a per-section theme) kept the root's scrollbar colours. `themeScope` names the elements
  that set their own tokens, and the variables are re-declared on each, so every scroller takes
  its colours from the nearest scope.

### Patch Changes

- `packageManager` now pins pnpm 11.21.0. The previous pin, 11.12.0, is a release pnpm refuses
  to install, so `pnpm install` failed in a fresh checkout.

## 0.1.0

### Minor Changes

- First release. A glass overlay scrollbar for React.
  
  - `<GlassScroll />` mounts once in a root layout, replaces the document scrollbar with a
    JavaScript-positioned overlay that reserves no layout width, and (with the default
    `scope="all"`) re-themes every nested native scrollbar to match.
  - `<GlassScrollArea />` turns any block into a scroll container with its own overlay, handling
    the positioned wrapper, the hidden native bar and keyboard focusability.
  - `useGlassScroll()` gives imperative access; `glass-scroll/core` exposes the framework-free
    engine as `createGlassScroll(target, options)`.
  - Vertical and horizontal axes, three presets, full CSS-variable theming with dark mode,
    reduced-motion and forced-colours fallbacks, and server-side rendering support.
