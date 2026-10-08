/**
 * `main` of `scripts/u5a-freeze-gate.ts`: the dev-split declaration gate (FR-v1.2E-24 amendment; Q11;
 * BR-U5a-36 a; D-U5a-13 a). It reads the detector's evaluation output, so it lives outside
 * `scripts/lib/mutation/**` (the BR-U5a-06 static check covers the mutation engine only).
 *
 * Usage (repository root, after U3 merges, with the lane or main Neo4j):
 *   GOLDEN_REQUIRED=1 NEO4J_URI=… npx tsx scripts/u5a-freeze-gate.ts --manifest <path> --copies <out root>
 *     --base <fixture dir> --out <dir>
 *
 * Refuses to run (exit 2) unless `GOLDEN_REQUIRED=1` and `NEO4J_URI` are set. For each distinct `specPath` of the
 * manifest rows the base is evaluated once (baseline); each row's copy `<copies>/<projectId>/<operatorId>/k-<k>` is
 * evaluated through the CLI as a subprocess (`bin/firewall.ts evaluate --format json --symbolic-only`, the entry that
 * calls `main()`; `src/cli/index.ts` is only a re-export barrel and prints nothing, with an
 * explicit environment: `PATH`, `HOME`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`). `compareDeclaredKeys`
 * (`freeze-gates.ts`) gives per row the new, expected, collateral and undeclared keys; all rows are written to
 * `<out>/u5a-declaration-gate.json` and one line per row is printed. Exit 0 every row passes; 1 a row has an
 * undeclared new key or an in-coverage positive shows no expected key; 2 refusal, usage or evaluation error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { MANIFEST_SCHEMA_PATH, knownSecrets, loadManifest } from './manifest.js';
import { compareDeclaredKeys } from './mutation/freeze-gates.js';
import type { DeclarationGateRow, EvaluatedViolations, ViolationKeyInput } from './mutation/freeze-gates.js';

export const FREEZE_GATE_USAGE = [
  'usage: GOLDEN_REQUIRED=1 NEO4J_URI=… npx tsx scripts/u5a-freeze-gate.ts --manifest <path> --copies <out root>',
  '         --base <fixture dir> --out <dir>',
  '',
  'Dev-split declaration gate (BR-U5a-36 a): evaluates the base and every manifest copy through the CLI and',
  'compares new keys with the declared expected and collateral keys. Exit 0 pass; 1 gate failure; 2 refusal/usage.',
  '',
].join('\n');

export const FREEZE_GATE_REFUSAL =
  'u5a-freeze-gate refuses to run without GOLDEN_REQUIRED=1 and NEO4J_URI: the declaration gate evaluates through the detector against Neo4j (BR-U5a-36 a)';

export const DECLARATION_GATE_FILE = 'u5a-declaration-gate.json';

/** The CLI entry that calls `main()` (`src/cli/index.ts` is a re-export barrel and exits 0 with no output). */
export const CLI_ENTRY = 'bin/firewall.ts';

export type Evaluate = (projectDir: string, specPath: string) => Promise<DomainResult<EvaluatedViolations>>;

export interface FreezeGateDeps {
  readonly env: NodeJS.ProcessEnv;
  /** Built from `env` when absent (the CLI subprocess). */
  readonly evaluate?: Evaluate;
  readonly runner?: ProcessRunner;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function defaultFreezeGateDeps(): FreezeGateDeps {
  return { env: process.env, runner: new NodeProcessRunner(), out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) };
}

/** Violation keys from the CLI's JSON output (tolerant: `violations[]` with `functionId` and `filePath`). */
export function violationsFromOutput(stdout: string): DomainResult<EvaluatedViolations> {
  const start = stdout.indexOf('{');
  if (start < 0) return DomainResult.fail([{ code: 'GATE_OUTPUT', message: 'evaluation printed no JSON object' }]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.slice(start));
  } catch {
    return DomainResult.fail([{ code: 'GATE_OUTPUT', message: 'evaluation output is not valid JSON' }]);
  }
  const list = (parsed as { violations?: unknown }).violations;
  if (!Array.isArray(list)) return DomainResult.fail([{ code: 'GATE_OUTPUT', message: 'evaluation output has no violations array' }]);
  const violations: ViolationKeyInput[] = [];
  for (const v of list as unknown[]) {
    const o = v as Record<string, unknown>;
    if (typeof o.functionId !== 'string' || typeof o.filePath !== 'string') continue;
    const disc = Array.isArray(o.discriminator) ? (o.discriminator as unknown[]).filter((d): d is string => typeof d === 'string') : [];
    violations.push({ functionId: o.functionId, filePath: o.filePath, target: typeof o.target === 'string' ? o.target : '', discriminator: disc });
  }
  return DomainResult.ok({ violations });
}

/** The CLI subprocess evaluator (explicit environment, no inherited secrets beyond the Neo4j triple). */
export function cliEvaluate(runner: ProcessRunner, repoRoot: string, env: NodeJS.ProcessEnv): Evaluate {
  const childEnv: Record<string, string> = {};
  for (const k of ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    const v = env[k];
    if (v !== undefined) childEnv[k] = v;
  }
  const tsx = path.resolve(repoRoot, 'node_modules/.bin/tsx');
  return async (projectDir, specPath) => {
    const args = [CLI_ENTRY, 'evaluate', '--project', projectDir, '--spec', specPath, '--format', 'json', '--symbolic-only', '--neo4j-uri', env.NEO4J_URI ?? ''];
    const run = await runner.run(tsx, args, { cwd: repoRoot, env: childEnv, timeoutMs: 600_000 });
    if (!run.success) return run;
    if (run.data.timedOut) return DomainResult.fail([{ code: 'GATE_TIMEOUT', message: `evaluation of ${path.basename(projectDir)} timed out` }]);
    return violationsFromOutput(run.data.stdout);
  };
}

interface Args {
  readonly manifest: string;
  readonly copies: string;
  readonly base: string;
  readonly out: string;
}

function parseArgs(argv: readonly string[]): Args | string {
  const v = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i] ?? '';
    const val = argv[i + 1];
    if (!['--manifest', '--copies', '--base', '--out'].includes(a) || val === undefined) return `unexpected argument ${JSON.stringify(a)}`;
    v.set(a, val);
  }
  for (const req of ['--manifest', '--copies', '--base', '--out']) if (!v.has(req)) return `${req} is required`;
  return { manifest: v.get('--manifest') ?? '', copies: v.get('--copies') ?? '', base: v.get('--base') ?? '', out: v.get('--out') ?? '' };
}

/** Runs the gate; returns the exit code. */
export async function main(argv: readonly string[], repoRoot: string, deps: FreezeGateDeps = defaultFreezeGateDeps()): Promise<number> {
  if (!fs.existsSync(path.resolve(repoRoot, MANIFEST_SCHEMA_PATH))) {
    deps.err('run from the repository root\n');
    return 2;
  }
  if (deps.env.GOLDEN_REQUIRED !== '1' || (deps.env.NEO4J_URI ?? '').length === 0) {
    deps.err(`${FREEZE_GATE_REFUSAL}\n`);
    return 2;
  }
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    deps.err(`${args}\n${FREEZE_GATE_USAGE}`);
    return 2;
  }
  const secrets = knownSecrets(deps.env);
  const fail = (code: string, message: string): number => {
    deps.err(`${scrubSecrets(`${code}: ${message}`, secrets)}\n`);
    return 2;
  };
  const manifest = loadManifest(repoRoot, path.resolve(repoRoot, args.manifest));
  if (!manifest.success) return fail(manifest.errors[0]?.code ?? 'MAN_INVALID', manifest.errors.map((e) => e.message).join('; '));
  const evaluate = deps.evaluate ?? cliEvaluate(deps.runner ?? new NodeProcessRunner(), repoRoot, deps.env);
  const baseDir = path.resolve(repoRoot, args.base);
  const baselines = new Map<string, EvaluatedViolations>();
  const results: DeclarationGateRow[] = [];
  for (const row of manifest.data.rows) {
    let baseline = baselines.get(row.specPath);
    if (baseline === undefined) {
      const b = await evaluate(baseDir, row.specPath);
      if (!b.success) return fail(b.errors[0]?.code ?? 'GATE_EVALUATE', `baseline under ${row.specPath}: ${b.errors.map((e) => e.message).join('; ')}`);
      baseline = b.data;
      baselines.set(row.specPath, baseline);
    }
    const copy = path.resolve(repoRoot, args.copies, row.projectId, row.operatorId, `k-${String(row.seedDerivation.k)}`);
    if (!fs.existsSync(copy)) return fail('GATE_COPY_MISSING', `copy of ${row.seedId} not found`);
    const m = await evaluate(copy, row.specPath);
    if (!m.success) return fail(m.errors[0]?.code ?? 'GATE_EVALUATE', `${row.seedId}: ${m.errors.map((e) => e.message).join('; ')}`);
    const r = compareDeclaredKeys(baseline, m.data, row);
    results.push(r);
    deps.out(`${r.passed ? 'PASS' : 'FAIL'} ${r.seedId} new=${String(r.newKeys.length)} undeclared=${String(r.undeclared.length)}${r.missingExpected ? ' missing-expected' : ''}\n`);
    for (const k of r.undeclared) deps.out(`  undeclared ${k}\n`);
  }
  const outDir = path.resolve(repoRoot, args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const passed = results.every((r) => r.passed);
  fs.writeFileSync(path.join(outDir, DECLARATION_GATE_FILE), JSON.stringify({ passed, rows: results }, null, 2) + '\n');
  return passed ? 0 : 1;
}
