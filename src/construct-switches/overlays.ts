/**
 * Declarations some construct options need and the presets do not state today. Each one is read only when its
 * option is chosen; with every question at A nothing here is used. They are written before any re-run, from the
 * question text, and not chosen from a measured result.
 */
import picomatch from 'picomatch';

/** Q10 B: the web/UI framework packages FF-P01 keeps in layered (the upward reach the style forbids). */
export const CONSTRUCT_WEB_UI_PACKAGES: readonly string[] = [
  'express', 'koa', 'fastify', '@hapi/*', 'hapi', 'restify', '@nestjs/*', 'next', 'react', 'react-dom', 'vue', '@angular/*', 'svelte',
];

/**
 * Q10 C: package-to-layer mapping, by style. A business-layer import of a mapped package is a dependency on that layer,
 * so FF-S01 reports it when the layer is above (the question's example: `express` mapped to the presentation layer).
 */
export const CONSTRUCT_PACKAGE_LAYERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  layered: { express: 'presentation', koa: 'presentation', fastify: 'presentation' },
};

/**
 * Q25 B (and the consumer rule of Q7 B): the composition-root role. A file that wires the application (a `main`, a test
 * container, a NestJS module) is exempt from the layer rules. Hexagonal and ddd composition layers are composition
 * roots already (`bindHexagonalLayers`).
 */
export const CONSTRUCT_COMPOSITION_ROOT_GLOBS: readonly string[] = [
  '**/main.ts', '**/*.module.ts', '**/*Container.ts', '**/*container.ts', '**/composition-root/**',
];

/** Q25 B: the layer rules (template names) the composition-root role is exempt from. */
export const CONSTRUCT_LAYER_RULE_TEMPLATES: readonly string[] = [
  'dependency-direction', 'no-layer-skip', 'no-domain-outward-dep',
  'dependency-direction-graph', 'layer-skip-graph', 'core-isolation',
];

/** Q5 D: the new rule. */
export const ADAPTER_ISOLATION_ID = 'FF-S05';
export const ADAPTER_ISOLATION_NAME = 'adapter-isolation';
/** Q17 C: the new advisory rule. */
export const BARREL_APPLICATION_ID = 'FF-DS03';
export const BARREL_APPLICATION_NAME = 'barrel-publishes-application';

/** Picomatch over project-relative paths (dot files included, as `annotateNodes`). */
export function globMatcher(globs: readonly string[]): (file: string) => boolean {
  if (globs.length === 0) return () => false;
  const m = picomatch(globs as string[], { dot: true });
  return (file) => m(file);
}

/** A package name against a list of names and `prefix/*` entries (the domain-purity matching). */
export function packageMatches(pkg: string, list: readonly string[]): boolean {
  return list.some((fp) => pkg === fp || (fp.endsWith('/*') && pkg.startsWith(fp.slice(0, -1))));
}
