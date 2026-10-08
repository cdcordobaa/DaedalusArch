/**
 * `main` of `scripts/mutate.ts` (FR-v1.2E-24; BR-U5a-04, 09, 31, 55; D-U5a-13 a, D-U5a-14).
 *
 * Usage (repository root):
 *   npx tsx scripts/mutate.ts --base <fixture dir | prepared.json> --spec <path> --operator <id>
 *     --manifest <path> --out <scratch dir> [--site <json>] [--k <n>] [--cycle-strategy simple-cycles|scc]
 *     [--split dev|held-out|probe]
 *   npx tsx scripts/mutate.ts --help
 *
 * One call applies one registered operator (catalogue `MO-*`, or an `SP-*` probe from the probe registry) to fresh
 * copies of one prepared base and appends the rows and rejections to the manifest (`applyMutation`). `--base` is a
 * fixture directory (prepared here with the repository's pinned tsc, `prepareFixtureBase`) or a `PreparedBase` JSON
 * file (validated by `makePreparedBase`; its `specPath` must equal `--spec`). `--site` forces one site
 * (BR-U5a-55; `{ "filePath", "line"?, "detail" }`), and `--k` is then its application index (default 0); without
 * `--site`, `--k` is the number of sampled sites and is required (`sitesPerOperator` is fixed only at the freeze).
 * `--cycle-strategy` (default `simple-cycles`) is written to a new manifest's header and must equal an existing
 * header (`MAN_CYCLE_STRATEGY_MISMATCH`, checked before any work). `--split` defaults to `dev`.
 *
 * Writes: copies, the analysis copy and the throwaway git object store of `baseTreeSha` under `--out`; the manifest
 * and its `.lock` at `--manifest`. Nothing else is written; the base is only read (BR-U5a-04).
 *
 * Exit codes: 0 every application appended a row; 3 the run completed and recorded at least one rejection
 * (`no-site`, `precondition`, `typecheck`, `apply-error`); 1 the engine refused the run (nothing appended, e.g.
 * `MUT_SITE_OVERRIDE_INVALID`, `MUT_BASE_NOT_CLEAN`, `MAN_LOCKED`); 2 usage, environment or input error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { MANIFEST_SCHEMA_PATH, knownSecrets, loadManifest } from '../manifest.js';
import type { Split } from '../manifest.js';
import { applyMutation } from './apply.js';
import type { MutationEnv } from './apply.js';
import { MASTER_SEED, loadCatalogueRegistry } from './operators/index.js';
import { loadProbeRegistry } from './operators/sp/index.js';
import { makePreparedBase, prepareFixtureBase } from './prepare.js';
import type { PreparedBaseInput } from './prepare.js';
import type { OperatorRegistry } from './registry.js';
import { CYCLE_STRATEGIES } from './types.js';
import type { ApplyOptions, CycleStrategy, PreparedBase } from './types.js';

export const MUTATE_USAGE = [
  'usage: npx tsx scripts/mutate.ts --base <fixture dir | prepared.json> --spec <path> --operator <id>',
  '         --manifest <path> --out <scratch dir> [--site <json>] [--k <n>]',
  '         [--cycle-strategy simple-cycles|scc] [--split dev|held-out|probe]',
  '       npx tsx scripts/mutate.ts --help',
  '',
  'Applies one registered operator to fresh copies of one prepared base and appends rows/rejections to the manifest.',
  '--site {"filePath","line"?,"detail"} forces one site (k = --k, default 0); without --site, --k sites are sampled.',
  'Exit: 0 rows only; 3 rejection(s) recorded; 1 refused (nothing appended); 2 usage or input error.',
  '',
].join('\n');

const SPLITS: readonly Split[] = ['dev', 'held-out', 'probe'];

export interface MutateMainDeps {
  readonly runner: ProcessRunner;
  /** Registry lookup by operator id: `SP-*` → the probe registry, else the catalogue registry. */
  readonly registryFor: (repoRoot: string, operatorId: string) => DomainResult<OperatorRegistry>;
  readonly now?: () => string;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function defaultMutateDeps(): MutateMainDeps {
  return {
    runner: new NodeProcessRunner(),
    registryFor: (repoRoot, operatorId) => (operatorId.startsWith('SP-') ? loadProbeRegistry(repoRoot) : loadCatalogueRegistry(repoRoot)),
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
  };
}

export interface MutateArgs {
  readonly help: boolean;
  readonly base?: string;
  readonly spec?: string;
  readonly operator?: string;
  readonly manifest?: string;
  readonly out?: string;
  readonly site?: NonNullable<ApplyOptions['siteOverride']>;
  readonly k?: number;
  readonly cycleStrategy: CycleStrategy;
  readonly split: Split;
}

function usage<T>(message: string): DomainResult<T> {
  return DomainResult.fail([{ code: 'MUT_USAGE', message }]);
}

/** Parses `--site` JSON into a site override (string detail values only). */
export function parseSiteJson(text: string): DomainResult<NonNullable<ApplyOptions['siteOverride']>> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return usage('--site is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return usage('--site must be a JSON object');
  const o = raw as Record<string, unknown>;
  const extra = Object.keys(o).filter((k) => !['filePath', 'line', 'detail'].includes(k));
  if (extra.length > 0) return usage(`--site has unknown field(s) ${extra.join(', ')}`);
  if (typeof o.filePath !== 'string' || o.filePath.length === 0) return usage('--site needs a non-empty "filePath"');
  if (o.line !== undefined && (typeof o.line !== 'number' || !Number.isInteger(o.line) || o.line < 1)) {
    return usage('--site "line" must be a positive integer');
  }
  const d = o.detail ?? {};
  if (typeof d !== 'object' || Array.isArray(d)) return usage('--site "detail" must be an object');
  const detail: Record<string, string> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (typeof v !== 'string') return usage(`--site detail.${k} must be a string`);
    detail[k] = v;
  }
  return DomainResult.ok({ filePath: o.filePath, ...(typeof o.line === 'number' ? { line: o.line } : {}), detail });
}

/** Parses the argument vector (no file access). */
export function parseMutateArgs(argv: readonly string[]): DomainResult<MutateArgs> {
  const values = new Map<string, string>();
  let help = false;
  const valued = ['--base', '--spec', '--operator', '--manifest', '--out', '--site', '--k', '--cycle-strategy', '--split'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--help' || a === '-h') {
      help = true;
      continue;
    }
    if (!valued.includes(a)) return usage(`unexpected argument ${JSON.stringify(a)}`);
    const v = argv[i + 1];
    if (v === undefined || (v.startsWith('--') && a !== '--site')) return usage(`${a} needs a value`);
    if (values.has(a)) return usage(`${a} given twice`);
    values.set(a, v);
    i++;
  }
  if (help) return DomainResult.ok({ help: true, cycleStrategy: 'simple-cycles', split: 'dev' });
  for (const req of ['--base', '--spec', '--operator', '--manifest', '--out']) {
    if (!values.has(req)) return usage(`${req} is required`);
  }
  const strategy = values.get('--cycle-strategy') ?? 'simple-cycles';
  if (!(CYCLE_STRATEGIES as readonly string[]).includes(strategy)) return usage(`--cycle-strategy must be one of ${CYCLE_STRATEGIES.join(', ')}`);
  const split = values.get('--split') ?? 'dev';
  if (!(SPLITS as readonly string[]).includes(split)) return usage(`--split must be one of ${SPLITS.join(', ')}`);
  let k: number | undefined;
  const kText = values.get('--k');
  if (kText !== undefined) {
    if (!/^\d+$/.test(kText)) return usage('--k must be a non-negative integer');
    k = Number(kText);
  }
  let site: NonNullable<ApplyOptions['siteOverride']> | undefined;
  const siteText = values.get('--site');
  if (siteText !== undefined) {
    const s = parseSiteJson(siteText);
    if (!s.success) return s;
    site = s.data;
  }
  if (site === undefined && (k === undefined || k < 1)) {
    return usage('without --site, --k (sites to sample, ≥ 1) is required: sitesPerOperator is fixed only at the freeze');
  }
  return DomainResult.ok({
    help: false,
    base: values.get('--base') ?? '',
    spec: values.get('--spec') ?? '',
    operator: values.get('--operator') ?? '',
    manifest: values.get('--manifest') ?? '',
    out: values.get('--out') ?? '',
    ...(site !== undefined ? { site } : {}),
    ...(k !== undefined ? { k } : {}),
    cycleStrategy: strategy as CycleStrategy,
    split: split as Split,
  });
}

/** `--base`: a fixture directory, or a `PreparedBase` JSON file whose `specPath` equals `--spec`. */
export async function resolveBase(runner: ProcessRunner, repoRoot: string, base: string, spec: string): Promise<DomainResult<PreparedBase>> {
  const abs = path.resolve(repoRoot, base);
  if (!fs.existsSync(abs)) return usage(`--base ${base} does not exist`);
  if (fs.statSync(abs).isDirectory()) return prepareFixtureBase(runner, repoRoot, abs, spec);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return usage(`--base ${path.basename(abs)} is neither a directory nor a JSON file`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return usage('prepared base JSON must be an object');
  const input = raw as PreparedBaseInput;
  if (input.specPath !== spec) {
    return DomainResult.fail([{ code: 'MUT_SPEC_MISMATCH', message: `--spec ${spec} differs from the prepared base's specPath` }]);
  }
  return makePreparedBase(input);
}

function report(deps: MutateMainDeps, errors: readonly DomainError[]): void {
  const secrets = knownSecrets();
  for (const e of errors) deps.err(`${scrubSecrets(`${e.code}: ${e.message}`, secrets)}\n`);
}

/** Runs the CLI; returns the exit code. */
export async function main(argv: readonly string[], repoRoot: string, deps: MutateMainDeps = defaultMutateDeps()): Promise<number> {
  if (!fs.existsSync(path.resolve(repoRoot, MANIFEST_SCHEMA_PATH))) {
    deps.err('run from the repository root\n');
    return 2;
  }
  const parsed = parseMutateArgs(argv);
  if (!parsed.success) {
    report(deps, parsed.errors);
    deps.err(MUTATE_USAGE);
    return 2;
  }
  const args = parsed.data;
  if (args.help) {
    deps.out(MUTATE_USAGE);
    return 0;
  }
  const operatorId = args.operator ?? '';
  const registry = deps.registryFor(repoRoot, operatorId);
  if (!registry.success) {
    report(deps, registry.errors);
    return 2;
  }
  if (registry.data.get(operatorId) === undefined) {
    report(deps, [{ code: 'MUT_UNKNOWN_OPERATOR', message: `operator ${operatorId} is not in the frozen registry` }]);
    return 2;
  }
  const manifestPath = path.resolve(repoRoot, args.manifest ?? '');
  if (fs.existsSync(manifestPath)) {
    const existing = loadManifest(repoRoot, manifestPath);
    if (!existing.success) {
      report(deps, existing.errors);
      return 2;
    }
    if (existing.data.cycleStrategy !== args.cycleStrategy) {
      report(deps, [
        {
          code: 'MAN_CYCLE_STRATEGY_MISMATCH',
          message: `--cycle-strategy ${args.cycleStrategy} differs from the manifest header's '${existing.data.cycleStrategy}'`,
        },
      ]);
      return 2;
    }
  }
  const base = await resolveBase(deps.runner, repoRoot, args.base ?? '', args.spec ?? '');
  if (!base.success) {
    report(deps, base.errors);
    return 2;
  }
  const outRoot = path.resolve(repoRoot, args.out ?? '');
  const rel = path.relative(base.data.dir, outRoot);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    report(deps, [{ code: 'MUT_COPY_INSIDE_BASE', message: '--out lies inside the base directory' }]);
    return 2;
  }
  const tmpRoot = path.join(outRoot, '.tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const env: MutationEnv = {
    repoRoot,
    runner: deps.runner,
    registry: registry.data,
    masterSeed: MASTER_SEED,
    sitesPerOperator: args.site === undefined ? (args.k ?? 1) : 1,
    split: args.split,
    tmpRoot,
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  };
  const opts: ApplyOptions = {
    cycleStrategy: args.cycleStrategy,
    ...(args.site !== undefined ? { siteOverride: args.site, ...(args.k !== undefined ? { k: args.k } : {}) } : {}),
  };
  const result = await applyMutation(env, base.data, operatorId, manifestPath, outRoot, opts);
  if (!result.success) {
    report(deps, result.errors);
    return 1;
  }
  deps.out(`${JSON.stringify({ operatorId, projectId: base.data.projectId, rows: result.data.rows, rejections: result.data.rejections })}\n`);
  return result.data.rejections > 0 ? 3 : 0;
}
