/**
 * Type route for `import('vega-lite')` under `moduleResolution: node` (tsconfig.scripts.json, jest, Gate B):
 * vega-lite 6 publishes its types only through `exports`, which node10 resolution ignores (OI-U5b-P2-2). At run
 * time the specifier is the package itself, loaded by dynamic `import()` from the tsx / ESM entry.
 */
declare module 'vega-lite' {
  export * from 'vega-lite/build/index.js';
}
