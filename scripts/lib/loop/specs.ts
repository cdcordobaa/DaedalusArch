/**
 * Per-task evaluator specs of the loop (v1.3 loop pilot; `Docs/v1.3/loop-pilot-readiness.md` §3).
 *
 * A plan may give each task its own spec:
 * - `static`: a spec file, the same for every step and arm (Clean: `specs/clean-arch.yaml`, the E1 instance of the
 *   clean-architecture preset; Hexagonal: `presets/hexagonal.yaml`).
 * - `ise-step1` (DDD only): a DDD spec cannot be written before the run, because where the agent puts its aggregates,
 *   layers and public APIs is its own choice. The harness therefore runs the ISE (`src/ise`, style forced to `ddd`) on
 *   the run's step-1 snapshot, constrains the inferred spec to the bounded contexts the plan declares
 *   (`constrainDddSpec`), validates it, and freezes it in the run directory (`spec/frozen-spec.yaml` and
 *   `spec/spec.json`). Every snapshot of the run, step 1 and its repair included, is evaluated against that frozen
 *   spec; it is never re-inferred. Each run freezes its own spec from its own step-1 tree.
 *
 * The constraint keeps the inference generic but stops it from legitimising erosion:
 * - contexts: exactly the declared roots (an inferred context that is not declared is dropped, so its files stay
 *   outside every context, FF-DS01; a declared context the agent did not create is still declared); each keeps the
 *   inferred public API and ACL plus the preset conventions `<root>index.ts`, `<root>contracts/**`, `<root>acl/**`;
 * - `outside_contexts`: only the preset's composition-root entries (an inferred `src/shared/**` is dropped);
 * - aggregates: the inferred ones of the declared contexts;
 * - layer folders: the inferred folders that lie in a declared context or are a composition entry, plus the preset's
 *   per-context globs (`src/*\/domain/**`, …) so that folders created at steps 2..k are still mapped;
 * - value objects, repositories, application services and domain event types: inferred ∪ preset conventions.
 * The ISE's raw output is kept beside the frozen spec (`spec/ise-raw.yaml`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { inferSpec } from '../../../src/ise/infer.js';
import { validateEmittedSpec } from '../../../src/ise/spec-emitter.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/index.js';
import { INSTRUMENT_VERSION } from '../../../src/fitness-compiler/role-exemptions.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { SpecCheck } from '../../../src/ise/spec-emitter.js';
import type { LoopContextDecl } from './style.js';

export const SPEC_DIR = 'spec';
export const FROZEN_SPEC_FILE = 'frozen-spec.yaml';
export const FROZEN_SPEC_RECORD = 'spec.json';
export const ISE_RAW_FILE = 'ise-raw.yaml';

const COMPOSITION = new Set(['config', 'composition']);

/** What the constraint changed in the inferred spec. */
export interface ConstraintReport {
  readonly declaredContexts: readonly string[];
  /** Inferred context roots that are not declared (their files belong to no context). */
  readonly droppedContexts: readonly string[];
  /** Declared roots the inference did not find. */
  readonly addedContexts: readonly string[];
  readonly droppedOutsideContexts: readonly string[];
  readonly droppedLayerDirectories: readonly string[];
  readonly aggregates: readonly string[];
}

/** `spec/spec.json` of a run with an ISE-frozen spec. */
export interface FrozenSpecRecord {
  readonly schema: 'loop-frozen-spec/v1';
  readonly taskId: string;
  readonly status: 'frozen' | 'failed';
  /** The step-1 snapshot commit the spec was inferred from. */
  readonly sourceCommit: string;
  readonly frozenAt: string;
  readonly specSha256: string | null;
  readonly ise?: { readonly classifiedBest: string; readonly confidence: number; readonly style: 'ddd' };
  readonly constraint?: ConstraintReport;
  readonly check?: SpecCheck;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface FrozenSpec {
  readonly specYaml: string;
  readonly iseRawYaml: string;
  readonly ise: NonNullable<FrozenSpecRecord['ise']>;
  readonly constraint: ConstraintReport;
  readonly check: SpecCheck;
}

/** Infers and freezes a run's DDD spec from a work tree (the step-1 snapshot). */
export type SpecFreezer = (workDir: string, contexts: readonly LoopContextDecl[]) => Promise<DomainResult<FrozenSpec>>;

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)];

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

interface PresetDdd {
  readonly layers: readonly { readonly name: string; readonly directories: readonly string[] }[];
  readonly outside: readonly string[];
  readonly valueObjects: readonly string[];
  readonly repositories: readonly string[];
  readonly eventTypes: readonly string[];
  readonly applicationServices: readonly string[];
}

function readPreset(presetText: string): PresetDdd {
  const doc = YAML.parse(presetText) as { architecture?: { layers?: { name?: unknown; directories?: unknown }[]; ddd?: Record<string, unknown> } };
  const layers = (doc.architecture?.layers ?? []).map((l) => ({ name: String(l.name), directories: strList(l.directories) }));
  const compositionEntries = layers.filter((l) => COMPOSITION.has(l.name)).flatMap((l) => l.directories);
  const ddd = doc.architecture?.ddd ?? {};
  return {
    layers,
    outside: compositionEntries,
    valueObjects: strList(ddd.value_objects),
    repositories: strList(ddd.repositories),
    eventTypes: strList(ddd.domain_event_types),
    applicationServices: strList(ddd.application_services),
  };
}

/** Constrains an ISE-inferred DDD spec to the declared contexts (module header). Pure. */
export function constrainDddSpec(iseYaml: string, presetText: string, contexts: readonly LoopContextDecl[]): { readonly specYaml: string; readonly report: ConstraintReport } {
  const preset = readPreset(presetText);
  const roots = contexts.map((c) => c.root);
  const inContext = (p: string): boolean => roots.some((r) => p.startsWith(r));
  const doc = YAML.parseDocument(iseYaml);
  const arch = doc.toJS() as { architecture?: { layers?: { name?: unknown; directories?: unknown }[]; ddd?: Record<string, unknown> } };
  const iseLayers = arch.architecture?.layers ?? [];
  const ddd = arch.architecture?.ddd ?? {};

  const droppedLayerDirectories: string[] = [];
  iseLayers.forEach((l, i) => {
    const name = String(l.name);
    const inferred = strList(l.directories);
    const kept = inferred.filter((d) => inContext(d) || preset.outside.includes(d));
    droppedLayerDirectories.push(...inferred.filter((d) => !kept.includes(d)));
    const presetDirs = preset.layers.find((p) => p.name === name)?.directories ?? [];
    const generic = presetDirs.filter((d) => d.startsWith('src/*/') || (COMPOSITION.has(name) && preset.outside.includes(d)));
    doc.setIn(['architecture', 'layers', i, 'directories'], doc.createNode(uniq([...kept, ...generic])));
  });

  const iseContexts = (Array.isArray(ddd.contexts) ? ddd.contexts : []) as { name?: unknown; root?: unknown; public_api?: unknown; acl?: unknown }[];
  const iseRoots = iseContexts.map((c) => String(c.root));
  const outCtx = contexts.map((c) => {
    const found = iseContexts.find((x) => String(x.root) === c.root);
    return {
      name: c.root.slice('src/'.length, -1),
      root: c.root,
      public_api: uniq([...strList(found?.public_api), `${c.root}index.ts`, `${c.root}contracts/**`]),
      acl: uniq([...strList(found?.acl), `${c.root}acl/**`]),
    };
  });
  const names = new Set(outCtx.map((c) => c.name));
  const aggregates = ((Array.isArray(ddd.aggregates) ? ddd.aggregates : []) as { name?: unknown; context?: unknown }[]).filter((a) => names.has(String(a.context)));
  const outside = strList(ddd.outside_contexts);
  const block = {
    source_root: 'src/',
    contexts: outCtx,
    outside_contexts: [...preset.outside],
    aggregates,
    value_objects: uniq([...strList(ddd.value_objects), ...preset.valueObjects]),
    repositories: uniq([...strList(ddd.repositories), ...preset.repositories]),
    domain_event_types: uniq([...strList(ddd.domain_event_types), ...preset.eventTypes]),
    application_services: uniq([...strList(ddd.application_services), ...preset.applicationServices]),
  };
  doc.setIn(['architecture', 'ddd'], doc.createNode(block));
  doc.commentBefore = [
    doc.commentBefore ?? '',
    ` Loop pilot: constrained to the declared bounded contexts ${roots.join(', ')} and frozen after step 1 (scripts/lib/loop/specs.ts).`,
  ].join('\n');
  return {
    specYaml: doc.toString({ lineWidth: 0 }),
    report: {
      declaredContexts: roots,
      droppedContexts: iseRoots.filter((r) => !roots.includes(r)),
      addedContexts: roots.filter((r) => !iseRoots.includes(r)),
      droppedOutsideContexts: outside.filter((o) => !preset.outside.includes(o)),
      droppedLayerDirectories: uniq(droppedLayerDirectories),
      aggregates: aggregates.map((a) => String(a.name)),
    },
  };
}

/**
 * The validator's verdict for a spec frozen after step 1. `LAYER_DIR_NOT_FOUND` is expected (a declared context or a
 * per-context layer folder the agent creates only at a later step; the evaluator does not require the folders to
 * exist), so it is kept as a warning; every other error still rejects the spec.
 */
export function freezeCheck(check: SpecCheck): SpecCheck {
  const missing = check.errors.filter((e) => e.startsWith('LAYER_DIR_NOT_FOUND'));
  const errors = check.errors.filter((e) => !e.startsWith('LAYER_DIR_NOT_FOUND'));
  return { valid: errors.length === 0, errors, warnings: [...check.warnings, ...missing] };
}

/**
 * The tsconfig of the ISE snapshot (the loop work tree has none; the harness keeps its tsconfig outside the cwd).
 * Same compiler options as the E1 harness tsconfig, which only affect import resolution here.
 */
export const ISE_SNAPSHOT_TSCONFIG = {
  compilerOptions: { strict: true, target: 'ES2022', lib: ['ES2022'], module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, skipLibCheck: true, noEmit: true },
  include: ['src/**/*.ts'],
};

/**
 * The errors of compiling the spec as the evaluator's pipeline does (`CompileCommand`: `compileFunctions` with the v1.3
 * options), for example `BR-SPEC-10 FF-DT01: aggregates`; none: [].
 */
export async function compileErrors(specYaml: string, tmpDir: string): Promise<readonly string[]> {
  const file = path.join(tmpDir, 'frozen-spec-check.yaml');
  fs.writeFileSync(file, specYaml);
  const parsed = await parseSpec({ specFilePath: file });
  if (!parsed.success) return parsed.errors.map((e) => `${e.code}: ${e.message}`);
  const compiled = compileFunctions(compilerInputFromSpec(parsed.data), { ...V13_COMPILE_OPTIONS, instrumentVersion: INSTRUMENT_VERSION });
  return compiled.success ? [] : compiled.errors.map((e) => e.message);
}

/** The real freezer: snapshot `src/` (ISE anti-leakage boundary), infer with style ddd, constrain, validate. */
export function iseDddFreezer(repoRoot: string): SpecFreezer {
  const presetsDir = path.resolve(repoRoot, 'presets');
  return async (workDir, contexts) => {
    const src = path.join(workDir, 'src');
    if (!fs.existsSync(src)) return DomainResult.fail([{ code: 'LOOP_SPEC_FREEZE_FAILED', message: 'the step-1 tree has no src/' }]);
    const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-ise-'));
    try {
      const dir = path.join(holder, 'project');
      fs.mkdirSync(dir);
      fs.cpSync(src, path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'tsconfig.json'), `${JSON.stringify(ISE_SNAPSHOT_TSCONFIG, null, 2)}\n`);
      const inference = await inferSpec(dir, { presetsDir, style: 'ddd' });
      const presetText = fs.readFileSync(path.join(presetsDir, 'ddd.yaml'), 'utf8');
      const { specYaml, report } = constrainDddSpec(inference.specYaml, presetText, contexts);
      const raw = await validateEmittedSpec(specYaml, dir);
      const neutral = (xs: readonly string[]): string[] => xs.map((x) => x.split(dir).join('<snapshot>'));
      const check = freezeCheck({ valid: raw.valid, errors: neutral(raw.errors), warnings: neutral(raw.warnings) });
      if (!check.valid) return DomainResult.fail([{ code: 'LOOP_SPEC_FREEZE_FAILED', message: `the constrained spec is invalid: ${check.errors.join('; ')}` }]);
      // The validator does not compile the spec. A spec the evaluator's compiler rejects (for example no aggregate
      // inferred: the ISE needs one sub-folder per aggregate under a context's domain folder, and FF-DT01/FF-DT02 then
      // cannot bind `aggregates`, BR-SPEC-10) is valid for it, but the evaluator then fails every snapshot. Reject it
      // here, so the failure is recorded once, on the freeze (found by the loop replay, Docs/v1.3/loop-replay.md).
      const compileErr = await compileErrors(specYaml, holder);
      if (compileErr.length > 0) return DomainResult.fail([{ code: 'LOOP_SPEC_FREEZE_FAILED', message: `the constrained spec cannot be compiled: ${compileErr.join('; ')}` }]);
      const top = inference.classification.ranked[0];
      return DomainResult.ok({
        specYaml,
        iseRawYaml: inference.specYaml,
        ise: { classifiedBest: inference.classification.best, confidence: top?.confidence ?? 0, style: 'ddd' },
        constraint: report,
        check,
      });
    } catch (e) {
      return DomainResult.fail([{ code: 'LOOP_SPEC_FREEZE_FAILED', message: e instanceof Error ? e.message : String(e) }]);
    } finally {
      fs.rmSync(holder, { recursive: true, force: true });
    }
  };
}
