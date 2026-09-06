# glass-scroll

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
