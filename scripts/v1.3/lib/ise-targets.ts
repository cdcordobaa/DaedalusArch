/**
 * ISE prototype measurement targets: the five dev reference projects as they are, and one robustness probe per
 * style (the same project with its layer directories renamed to non-standard names, imports rewritten). P1 is the
 * primary probe (clean-architecture: core -> kernel, application -> orchestration, infrastructure -> platform).
 *
 * Ground truth for a probe is the reference's own, mapped through the same renaming: expected layers, the true
 * spec's globs (and DDD block), expected findings. Evaluation code only; src/ise never imports this.
 *
 * `ISE_TARGETS` is the prototype's set; its P1-P5 rename map is the DEVELOPMENT probe of the robustness fixes.
 * `ISE_HELDOUT_TARGETS` are the held-out probes of `ise-probes.ts` (N1, N2, S), defined before the fixed code ran
 * on them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { CONTAINER_TOKENS, LAYER_SYNONYMS, STYLE_TOKENS } from '../../../src/ise/vocabulary.js';
import { applyProbe, generateProbes, probeFindingPath, probePath, scramblePattern } from './ise-probes.js';
import type { ProbeDefinition } from './ise-probes.js';
import { renameFindingPath, renameGlob, renamePath, renameProject } from './ise-rename.js';
import type { RenameMap } from './ise-rename.js';
import { materialiseVariant } from './materialise.js';
import { REFERENCE_STYLES } from './reference-model.js';
import type { ExpectedFinding, LoadedReference, LoadedVariant, ReferenceStyle } from './reference-model.js';

export interface IseTarget {
  readonly id: string;
  readonly style: ReferenceStyle;
  /** Empty for the reference as it is (and for a held-out probe, which uses `probe`). */
  readonly rename: RenameMap;
  readonly probe?: ProbeDefinition;
}

export const ISE_TARGETS: readonly IseTarget[] = [
  { id: 'clean-architecture', style: 'clean-architecture', rename: {} },
  { id: 'layered', style: 'layered', rename: {} },
  { id: 'nestjs', style: 'nestjs', rename: {} },
  { id: 'hexagonal', style: 'hexagonal', rename: {} },
  { id: 'ddd', style: 'ddd', rename: {} },
  { id: 'P1-clean-architecture-renamed', style: 'clean-architecture', rename: { 'src/domain': 'src/kernel', 'src/application': 'src/orchestration', 'src/infrastructure': 'src/platform' } },
  { id: 'P2-layered-renamed', style: 'layered', rename: { 'src/presentation': 'src/frontend', 'src/business': 'src/kernel', 'src/persistence': 'src/platform' } },
  { id: 'P3-nestjs-renamed', style: 'nestjs', rename: { 'src/domain': 'src/kernel', 'src/common': 'src/platform' } },
  {
    id: 'P4-hexagonal-renamed', style: 'hexagonal',
    rename: { 'src/domain': 'src/kernel', 'src/application': 'src/orchestration', 'src/adapters/inbound': 'src/plugins/entry', 'src/adapters/outbound': 'src/plugins/exit', 'src/config': 'src/setup' },
  },
  {
    id: 'P5-ddd-renamed', style: 'ddd',
    rename: {
      'src/ordering/domain': 'src/ordering/kernel', 'src/billing/domain': 'src/billing/kernel',
      'src/ordering/application': 'src/ordering/orchestration', 'src/billing/application': 'src/billing/orchestration',
      'src/ordering/infrastructure': 'src/ordering/platform', 'src/billing/infrastructure': 'src/billing/platform',
    },
  },
];

/**
 * Names the held-out probes must not draw: every ISE vocabulary token, every directory name of the reference projects
 * (`REFERENCE_DIR_NAMES`, checked against the fixtures by a unit test) and every development-probe name.
 */
export const REFERENCE_DIR_NAMES: readonly string[] = [
  'acl', 'adapters', 'api', 'application', 'attendees', 'billing', 'business', 'cli', 'common', 'config', 'contracts', 'customer',
  'domain', 'dto', 'entities', 'errors', 'events', 'filters', 'guards', 'http', 'in', 'inbound', 'infrastructure', 'invoice', 'model',
  'notification', 'order', 'ordering', 'out', 'outbound', 'payment', 'persistence', 'ports', 'presentation', 'records', 'registrations',
  'repositories', 'services', 'shared-kernel', 'system', 'use-cases', 'value-objects', 'views', 'workshops',
];

export function probeExclusions(): string[] {
  const dev = ISE_TARGETS.flatMap((t) => Object.values(t.rename).flatMap((p) => p.split('/')));
  const vocab = [...Object.values(LAYER_SYNONYMS).flat(), ...Object.values(STYLE_TOKENS).flat(), ...CONTAINER_TOKENS];
  return [...new Set([...vocab, ...REFERENCE_DIR_NAMES, ...dev])].sort();
}

/** The held-out probes (N1, N2, S per style), in `ise-probes.ts` order. */
export const ISE_HELDOUT_TARGETS: readonly IseTarget[] = generateProbes(REFERENCE_STYLES, probeExclusions()).map((probe) => ({
  id: probe.id,
  style: probe.style,
  rename: {},
  probe,
}));

export type TargetSet = 'dev' | 'heldout' | 'all';

/** `--set dev` (default: the prototype's targets, P1-P5 the development probe), `heldout` (N1, N2, S) or `all`. */
export function targetSet(argv: readonly string[]): readonly IseTarget[] {
  const i = argv.indexOf('--set');
  const set = i >= 0 ? argv[i + 1] ?? '' : 'dev';
  if (set === 'dev') return ISE_TARGETS;
  if (set === 'heldout') return ISE_HELDOUT_TARGETS;
  if (set === 'all') return [...ISE_TARGETS, ...ISE_HELDOUT_TARGETS];
  throw new Error(`--set ${set}: expected dev, heldout or all`);
}

/** Materialises `variant` of `ref` under `work` and applies the target's renaming; returns the project directory. */
export function materialiseTarget(ref: LoadedReference, variant: LoadedVariant, target: IseTarget, work: string): string {
  const m = materialiseVariant(ref, variant, path.join(work, target.id));
  if (target.probe !== undefined) applyProbe(m.projectDir, target.probe);
  else if (Object.keys(target.rename).length > 0) renameProject(m.projectDir, target.rename);
  return m.projectDir;
}

/** A project-relative file path of the reference in the target's form. */
export function targetPath(p: string, target: IseTarget): string {
  return target.probe !== undefined ? probePath(p, target.probe, 'file') : renamePath(p, target.rename);
}

/** A glob of the reference's spec in the target's form. */
function targetGlob(g: string, target: IseTarget): string {
  if (target.probe === undefined) return renameGlob(g, target.rename);
  // `src/main.ts`-like entries name a file; everything else in a layer list is a directory glob.
  const isFile = /\.[a-z]+$/.test(g.split('/').pop() ?? '') || g.endsWith('*.ts');
  return probePath(g, target.probe, isFile ? 'file' : 'dir');
}

/**
 * The true spec's YAML for the target: the reference spec, its layer globs and DDD block renamed; for the scrambled
 * probe also the layer file patterns and the fitness functions' naming `pattern`s.
 */
export function trueSpecText(ref: LoadedReference, target: IseTarget): string {
  const text = fs.readFileSync(ref.specPath, 'utf8');
  if (Object.keys(target.rename).length === 0 && target.probe === undefined) return text;
  const doc = YAML.parseDocument(text);
  const raw = doc.toJS() as {
    architecture: { layers: { directories?: string[]; file_patterns?: string[] }[]; ddd?: unknown };
    fitness_functions?: { pattern?: unknown }[];
  };
  raw.architecture.layers.forEach((l, i) => {
    if (l.directories !== undefined) doc.setIn(['architecture', 'layers', i, 'directories'], doc.createNode(l.directories.map((g) => targetGlob(g, target))));
    const probe = target.probe;
    if (l.file_patterns !== undefined && probe !== undefined && Object.keys(probe.suffixes).length > 0) {
      doc.setIn(['architecture', 'layers', i, 'file_patterns'], doc.createNode(l.file_patterns.map((g) => probePath(g, probe, 'file'))));
    }
  });
  if (raw.architecture.ddd !== undefined) doc.setIn(['architecture', 'ddd'], doc.createNode(renameDeep(raw.architecture.ddd, target)));
  const probe = target.probe;
  if (probe !== undefined && Object.keys(probe.suffixes).length > 0) {
    (raw.fitness_functions ?? []).forEach((f, i) => {
      if (typeof f.pattern === 'string') doc.setIn(['fitness_functions', i, 'pattern'], scramblePattern(f.pattern, probe.suffixes));
    });
  }
  return doc.toString({ lineWidth: 0 });
}

function renameDeep(x: unknown, target: IseTarget): unknown {
  if (typeof x === 'string') return x.includes('/') ? targetGlob(x, target) : x;
  if (Array.isArray(x)) return x.map((v) => renameDeep(v, target));
  if (x !== null && typeof x === 'object') return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, renameDeep(v, target)]));
  return x;
}

export function renamedExpectedLayers(ref: LoadedReference, target: IseTarget): { path: string; layer: string | null }[] {
  return ref.graph.files.map((f) => ({ path: targetPath(f.path, target), layer: f.layer }));
}

export function renamedFindings(findings: readonly ExpectedFinding[], target: IseTarget): ExpectedFinding[] {
  const fp = (p: string): string => (target.probe !== undefined ? probeFindingPath(p, target.probe) : renameFindingPath(p, target.rename));
  return findings.map((f) => ({
    ...f,
    file: fp(f.file),
    ...(f.target !== undefined ? { target: fp(f.target) } : {}),
  }));
}
