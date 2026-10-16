/**
 * `check_import`: would an import from file A to module B break a rule? Spec-based and graph-free: the target
 * is resolved lexically (relative specifiers against the importing file, bare specifiers as project-relative
 * paths first, then as packages), mapped to a layer by the spec's globs, and judged by the import rules in
 * `spec-rules.ts`. Pure. Anything that cannot be resolved without TypeScript's module resolution (tsconfig
 * `paths` aliases) comes back `unknown`, never a guessed `allowed`.
 */
import * as path from 'node:path';
import type { ParsedSpec } from '../shared/types/spec.js';
import { isBuiltinSpecifier } from '../apg-extractor/package-node-factory.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import { activeImportRules, layerPairHits, packageHits } from './spec-rules.js';
import type { CheckImportResult, ImportTargetKind, RuleHit } from './types.js';

export interface CheckImportInput {
  /** Project-relative path of the importing file. */
  readonly fromFile: string;
  /** The import specifier as written in the source. */
  readonly module: string;
  /** Project-relative path the specifier resolves to, when the caller knows it (alias imports). */
  readonly resolvedPath?: string | undefined;
}

const SOURCE_EXTENSION_RE = /\.(?:[cm]?[jt]sx?)$/;

/** `@scope/name/sub` to `@scope/name`; `name/sub` to `name` (the Package node name). */
export function packageRoot(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/** Candidate file paths of a module path: the path itself, with a source extension, and as a directory index. */
function candidatePaths(modulePath: string): readonly string[] {
  const bare = modulePath.replace(SOURCE_EXTENSION_RE, '');
  return [modulePath, `${bare}.ts`, `${bare}/index.ts`];
}

function layerOfModulePath(spec: ParsedSpec, modulePath: string): string | null {
  for (const candidate of candidatePaths(modulePath)) {
    const match = resolveLayer(spec, candidate);
    if (match !== undefined) return match.layer;
  }
  return null;
}

interface Target {
  readonly kind: ImportTargetKind;
  readonly path?: string;
  readonly package?: string;
  readonly layer: string | null;
  readonly notes: readonly string[];
}

function resolveTarget(spec: ParsedSpec, input: CheckImportInput, fromFile: string): Target {
  if (input.resolvedPath !== undefined) {
    const resolved = normalisePath(input.resolvedPath);
    return {
      kind: 'internal',
      path: resolved,
      layer: layerOfModulePath(spec, resolved),
      notes: ['target path supplied by the caller'],
    };
  }
  const specifier = input.module;
  if (isBuiltinSpecifier(specifier))
    return { kind: 'node-builtin', package: specifier, layer: null, notes: [] };
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const resolved = specifier.startsWith('/')
      ? normalisePath(specifier)
      : normalisePath(path.posix.join(path.posix.dirname(fromFile), specifier));
    return {
      kind: 'internal',
      path: resolved,
      layer: layerOfModulePath(spec, resolved),
      notes: [],
    };
  }
  // Bare specifier: a baseUrl-style project path (`src/domain/x`) when a layer claims it, otherwise a package.
  const asPath = normalisePath(specifier);
  const baseUrlLayer = layerOfModulePath(spec, asPath);
  if (baseUrlLayer !== null) {
    return {
      kind: 'internal',
      path: asPath,
      layer: baseUrlLayer,
      notes: ['bare specifier read as a project-relative path'],
    };
  }
  return { kind: 'external-package', package: packageRoot(specifier), layer: null, notes: [] };
}

function describe(target: Target, specifier: string): CheckImportResult['to'] {
  return {
    specifier,
    kind: target.kind,
    ...(target.path !== undefined ? { path: target.path } : {}),
    ...(target.package !== undefined ? { package: target.package } : {}),
    layer: target.layer,
  };
}

export function checkImport(spec: ParsedSpec, input: CheckImportInput): CheckImportResult {
  const fromFile = normalisePath(input.fromFile);
  const fromLayer = resolveLayer(spec, fromFile)?.layer ?? null;
  const target = resolveTarget(spec, input, fromFile);
  const checkedRules = activeImportRules(spec).map((ff) => String(ff.id));
  const notes: string[] = [...target.notes];
  const from = { path: fromFile, layer: fromLayer };

  if (fromLayer === null) {
    notes.push('the importing file belongs to no layer, so layer rules do not apply to it');
  }

  let violations: readonly RuleHit[] = [];
  if (fromLayer !== null && target.kind === 'internal' && target.layer !== null) {
    violations = layerPairHits(spec, fromLayer, target.layer, fromFile);
  } else if (target.kind === 'external-package' && target.package !== undefined) {
    violations = packageHits(spec, fromLayer, target.package, fromFile);
  } else if (target.kind === 'internal' && target.layer === null) {
    notes.push('the target belongs to no layer, so layer rules do not apply to it');
  }

  const unresolvedAlias =
    target.kind === 'external-package' && /^(?:@\/|~\/?|#)/.test(input.module);
  if (unresolvedAlias) {
    notes.push(
      'the specifier looks like a path alias; pass resolvedPath to check it against the layers',
    );
  }

  const verdict = violations.length > 0 ? 'violation' : unresolvedAlias ? 'unknown' : 'allowed';
  return {
    verdict,
    from,
    to: describe(target, input.module),
    violations,
    checkedRules,
    notes,
  };
}
