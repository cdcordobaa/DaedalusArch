/**
 * Pre-registration library and gate (FR-25, FR-36; ADR-015 items 1, 2; BR-U5b-50, 51; U5b domain-entities §7).
 *
 * - `REGISTERED_ARTEFACTS` is the closed registry of BR-U5b-51 (path patterns over the repository).
 * - `loadPreRegistration` reads `corpus/prereg.json` and validates it against
 *   `scripts/lib/schemas/prereg.schema.json` (ajv); `version > 1` needs a `reason` and `previous` entries.
 * - `buildPreRegistration` hashes every committed file the registry matches (the registration step, Step 32).
 * - `checkPreRegistration` is the gate `run-experiment` runs before anything else. It refuses a plan unless
 *   (a) `corpus/prereg.json` is committed and the working-tree file equals the HEAD blob, (b) its last commit is
 *   older than the plan's first `RunRecord.startedAt` under the current version (the run about to start when the
 *   plan has none), and (c) every registered artefact's current sha256 equals its registered hash. It also refuses
 *   a plan file that is not itself registered and a plan whose spec lies outside `corpus/specs/` and the fixture
 *   specs (BR-U5b-51). Earlier records keep their own `preregVersion`; the gate never rewrites them.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { PREREG_FILE } from './matching-rule.js';

export { PREREG_FILE };
export const PREREG_SCHEMA_PATH = 'scripts/lib/schemas/prereg.schema.json';
export const PREREG_REFUSED = 'PREREG_REFUSED';

/**
 * Specs a plan may evaluate with (BR-U5b-51): the corpus specs and the fixture specs, i.e. the spec of the C16
 * suite and the layered fixture spec of the SP-FF-S03 probe and MO-S03 (OI-U5b-P2-4; U5a catalogue §SP).
 */
export const CORPUS_SPEC_PATTERN = 'corpus/specs/*.yaml';
export const FIXTURE_SPECS: readonly string[] = Object.freeze(['specs/clean-arch.yaml', 'tests/fixtures/u5a/layered/firewall.spec.yaml']);

/** The style presets (`presets/*.yaml`), the library instances a corpus spec is copied from (ADR-021 SO1-D). */
export const PRESET_PATTERN = 'presets/*.yaml';

/**
 * BR-U5b-51: the registered artefacts, as repository path patterns (`*` within a segment, `**` across).
 * ADR-021 SO1-D adds the fixture specs (the evaluator spec of every fixture run and all E1 cells, and the layered
 * fixture spec of SP-FF-S03 and MO-S03) and the style presets, so every spec a plan may evaluate with is hashed.
 * A registration made before the addition stays valid (its paths are a subset); the P-U6 bump hashes the new ones.
 */
export const REGISTERED_ARTEFACTS: readonly string[] = Object.freeze([
  'Docs/matching-rule.md',
  'Docs/analysis-plan.md',
  'Docs/operator-catalogue.md',
  'Docs/generator-protocol.md',
  'scripts/generator/prompts/*.md',
  'Docs/corpus-criteria.md',
  'Docs/labeller-prompts/*',
  'corpus/corpus.json',
  'corpus/overlays/**',
  CORPUS_SPEC_PATTERN,
  'experiments/*/plan.json',
  'corpus/frozen-instrument.json',
  // ADR-019 item 3 with the methodology constraint (Build and Test Step 55): the mechanical E7 spec rule and its generator.
  'Docs/e7-spec-rule.md',
  'scripts/generate-e7-specs.ts',
  ...FIXTURE_SPECS,
  PRESET_PATTERN,
]);

export interface PreRegistration {
  readonly version: number;
  readonly registeredAt: string;
  readonly reason?: string;
  readonly matchingRuleVersion: string;
  readonly artefacts: readonly { readonly path: string; readonly sha256: string }[];
  readonly labellingBudgetCalls: number;
  readonly e1Grid: { readonly models: 3; readonly specLevels: 3; readonly tasks: 2; readonly runs: 3 };
  readonly previous?: readonly { readonly version: number; readonly commit: string }[];
}

export type PreregRefusal =
  | 'prereg-missing' | 'prereg-invalid' | 'prereg-uncommitted' | 'prereg-too-new' | 'artefact-changed'
  | 'artefact-missing' | 'plan-unregistered' | 'spec-outside-corpus';

export type PreregCheck =
  | { readonly ok: true; readonly prereg: PreRegistration; readonly frozenHashes: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly code: typeof PREREG_REFUSED; readonly refusal: PreregRefusal; readonly detail: string };

// ---------------------------------------------------------------------------------------------
// Patterns and hashing

function globRegex(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i] ?? '';
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else {
      re += /[.+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** True when the repository-relative `path` matches one registry pattern. */
export function matchesPattern(path: string, pattern: string): boolean {
  return globRegex(pattern).test(path);
}

export function isRegisteredPath(path: string): boolean {
  return REGISTERED_ARTEFACTS.some((p) => matchesPattern(path, p));
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function git(repoRoot: string, args: readonly string[]): { ok: true; out: string } | { ok: false } {
  try {
    return { ok: true, out: execFileSync('git', [...args], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) };
  } catch {
    return { ok: false };
  }
}

/** Committed files (HEAD index) matching the registry, sorted. */
export function registeredArtefactPaths(repoRoot: string): string[] {
  const listed = git(repoRoot, ['ls-files', '-z']);
  if (!listed.ok) return [];
  return listed.out.split('\0').filter((p) => p !== '' && isRegisteredPath(p)).sort();
}

/** The repository-relative POSIX form of `path` (absolute or relative to `repoRoot`). */
export function repoRelative(repoRoot: string, path: string): string {
  return relative(resolve(repoRoot), resolve(repoRoot, path)).split(/[\\/]/).join(posix.sep);
}

// ---------------------------------------------------------------------------------------------
// Load and build

const validators = new Map<string, ValidateFunction>();

function validator(schemaRoot: string): ValidateFunction {
  const schemaPath = resolve(schemaRoot, PREREG_SCHEMA_PATH);
  const cached = validators.get(schemaPath);
  if (cached !== undefined) return cached;
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>);
  validators.set(schemaPath, validate);
  return validate;
}

/** Validates a parsed `PreRegistration`; returns the problems (empty when valid). */
export function validatePreRegistration(value: unknown, schemaRoot: string): string[] {
  const validate = validator(schemaRoot);
  if (!validate(value)) {
    return (validate.errors ?? []).map((e) => `${e.instancePath === '' ? '/' : e.instancePath} ${e.message ?? 'invalid'}`);
  }
  const p = value as PreRegistration;
  const problems: string[] = [];
  if (p.version > 1 && (p.reason === undefined || p.reason.trim() === '')) problems.push('version > 1 needs a reason (BR-U5b-50)');
  if (p.version > 1 && (p.previous ?? []).length !== p.version - 1) problems.push('version > 1 lists every earlier version in previous');
  const paths = p.artefacts.map((a) => a.path);
  if (new Set(paths).size !== paths.length) problems.push('artefact paths must be unique');
  for (const path of paths) if (!isRegisteredPath(path)) problems.push(`${path} is not a registered artefact (BR-U5b-51)`);
  return problems;
}

export type PreregLoad =
  | { readonly ok: true; readonly value: PreRegistration }
  | { readonly ok: false; readonly refusal: 'prereg-missing' | 'prereg-invalid'; readonly detail: string };

/**
 * Reads `corpus/prereg.json` under `repoRoot`. `schemaRoot` (default `repoRoot`) is where the schema is read from,
 * so a temp repository in a test can be checked with the schema of this checkout.
 */
export function loadPreRegistration(repoRoot: string, schemaRoot: string = repoRoot): PreregLoad {
  const file = join(repoRoot, PREREG_FILE);
  if (!existsSync(file)) return { ok: false, refusal: 'prereg-missing', detail: `${PREREG_FILE} does not exist` };
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch (e) {
    return { ok: false, refusal: 'prereg-invalid', detail: `${PREREG_FILE} is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const problems = validatePreRegistration(value, schemaRoot);
  if (problems.length > 0) return { ok: false, refusal: 'prereg-invalid', detail: `${PREREG_FILE}: ${problems.join('; ')}` };
  return { ok: true, value: value as PreRegistration };
}

export interface BuildFields {
  readonly version: number;
  readonly registeredAt: string;
  readonly reason?: string;
  readonly matchingRuleVersion: string;
  readonly labellingBudgetCalls: number;
  readonly previous?: readonly { readonly version: number; readonly commit: string }[];
}

/** The registration value over every committed registered artefact (hashes of the working-tree files). */
export function buildPreRegistration(repoRoot: string, fields: BuildFields): PreRegistration {
  const artefacts = registeredArtefactPaths(repoRoot).map((path) => ({ path, sha256: sha256File(join(repoRoot, path)) }));
  return {
    version: fields.version,
    registeredAt: fields.registeredAt,
    ...(fields.reason !== undefined && { reason: fields.reason }),
    matchingRuleVersion: fields.matchingRuleVersion,
    artefacts,
    labellingBudgetCalls: fields.labellingBudgetCalls,
    e1Grid: { models: 3, specLevels: 3, tasks: 2, runs: 3 },
    ...(fields.previous !== undefined && { previous: fields.previous }),
  };
}

// ---------------------------------------------------------------------------------------------
// The gate (BR-U5b-50, 51)

export interface PreregCheckInput {
  readonly repoRoot: string;
  /** Where the schema is read from (default `repoRoot`). */
  readonly schemaRoot?: string;
  /** The plan file (absolute or repository-relative). */
  readonly planPath: string;
  /** The plan's spec paths (repository-relative or absolute). */
  readonly specPaths: readonly string[];
  /** The plan's existing records (`startedAt`, `preregVersion`); empty before its first run. */
  readonly records: readonly { readonly startedAt: string; readonly preregVersion: number }[];
  /** Start time of the run about to happen (used when the plan has no record under the current version). */
  readonly now: Date;
}

function refuse(refusal: PreregRefusal, detail: string): PreregCheck {
  return { ok: false, code: PREREG_REFUSED, refusal, detail };
}

function specAllowed(path: string): boolean {
  return matchesPattern(path, CORPUS_SPEC_PATTERN) || FIXTURE_SPECS.includes(path);
}

export function checkPreRegistration(input: PreregCheckInput): PreregCheck {
  const { repoRoot } = input;
  for (const spec of input.specPaths) {
    const rel = repoRelative(repoRoot, spec);
    if (!specAllowed(rel)) return refuse('spec-outside-corpus', `spec ${rel} is not under corpus/specs/ and not a fixture spec (BR-U5b-51)`);
  }
  const loaded = loadPreRegistration(repoRoot, input.schemaRoot ?? repoRoot);
  if (!loaded.ok) return refuse(loaded.refusal, loaded.detail);
  const prereg = loaded.value;

  // (a) committed, and the working-tree file equals the HEAD blob.
  const headBlob = git(repoRoot, ['rev-parse', `HEAD:${PREREG_FILE}`]);
  if (!headBlob.ok) return refuse('prereg-uncommitted', `${PREREG_FILE} is not committed at HEAD`);
  const workBlob = git(repoRoot, ['hash-object', '--', PREREG_FILE]);
  if (!workBlob.ok || workBlob.out.trim() !== headBlob.out.trim()) {
    return refuse('prereg-uncommitted', `${PREREG_FILE} differs from its committed blob`);
  }

  // (b) the registration commit is older than the plan's first run under this version.
  const ct = git(repoRoot, ['log', '-1', '--format=%ct', '--', PREREG_FILE]);
  const committedAtMs = ct.ok ? Number(ct.out.trim()) * 1000 : Number.NaN;
  if (!Number.isFinite(committedAtMs)) return refuse('prereg-uncommitted', `no commit time for ${PREREG_FILE}`);
  const underVersion = input.records.filter((r) => r.preregVersion === prereg.version).map((r) => Date.parse(r.startedAt));
  const firstRunMs = underVersion.length > 0 ? Math.min(...underVersion) : input.now.getTime();
  if (!(committedAtMs < firstRunMs)) {
    return refuse('prereg-too-new', `${PREREG_FILE} v${String(prereg.version)} committed at ${new Date(committedAtMs).toISOString()}, not before the first run at ${new Date(firstRunMs).toISOString()}`);
  }

  // (c) every registered artefact unchanged.
  const frozenHashes: Record<string, string> = {};
  for (const a of prereg.artefacts) {
    const file = join(repoRoot, a.path);
    if (!existsSync(file)) return refuse('artefact-missing', `registered artefact ${a.path} is missing`);
    const now = sha256File(file);
    if (now !== a.sha256) return refuse('artefact-changed', `registered artefact ${a.path} changed (sha256 ${now} != ${a.sha256})`);
    frozenHashes[a.path] = a.sha256;
  }

  const planRel = repoRelative(repoRoot, input.planPath);
  if (frozenHashes[planRel] === undefined) return refuse('plan-unregistered', `plan ${planRel} is not a registered artefact`);
  return { ok: true, prereg, frozenHashes };
}
