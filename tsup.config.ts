import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    // No rollup treeshake pass: it strips the "use client" banner below (and warns about it).
    // esbuild's own bundling already drops unused code, and the consumer's bundler tree-shakes
    // the published ESM via "sideEffects": false.
    target: 'es2020',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    // Marks the React entry as a client-component boundary for React Server Components.
    // Must be the first bytes of the file, hence a banner rather than a source directive
    // (esbuild would otherwise drop or reorder it when bundling).
    banner: { js: '"use client";' },
    outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  },
  {
    entry: { core: 'src/core.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    target: 'es2020',
    outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  },
])
