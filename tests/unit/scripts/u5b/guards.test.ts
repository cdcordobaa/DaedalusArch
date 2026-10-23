/**
 * U5b CI guards run by the existing scripts-project test step (`npm test`; `.github/**` untouched).
 * BR-U5b-56: no U5b commit adds or changes anything under `results/`. The check reads git history and fails (never
 * skips) when `origin/v1.2e` cannot be resolved. Build and Test re-scoped it (BT Step 5): under `results/`, only
 * `results/pre-tag/**` (FR-18), `results/labels/**` (runbook stage 6, the label plan) and `results/<registered plan id>/**` whose `runs/*.run.json` are schema-valid
 * `RunRecord`s of that plan (at least one) are allowed; anything else fails. Checked over the tracked files and the
 * branch diff against `origin/v1.2e`. Since 2026-10-16 (decision-chronology row 14) v1.3's result folders are allowed
 * too, by folder pattern (`results/v1.3/**`, `results/v1.3-<name>/**`, `V13_RESULTS_DIR_PATTERN`); the v1.2E rules
 * above are unchanged, so a v1.3 commit that touches a v1.2E result folder still fails. The v1.4 AI-DLC cycle
 * (`aidlc-docs/inception/v1.4/`) adds `results/v1.4-<name>/**` to the same pattern, and the v1.5 exploratory cycle adds `results/v1.5-<name>/**`.
 * BR-U5b-44 (Step 28): no test under `tests/unit/scripts/**` constructs the live Gemini provider or imports its
 * constructor as a value; U5b tests label through Mock providers and cassettes only.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EXTERNAL_RUNNER_KINDS, validateRunRecord } from '../../../../scripts/run-experiment.js';
import { LABELS_RESULTS_DIR, resultsPathAllowed, v13ResultsPath } from '../../../golden/check-changes-log.js';
import { ROOT } from './score-fixture.js';

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).trim();
}

/**
 * Problems of a set of `results/` paths (BR-U5b-56 as re-scoped by Build and Test). `readRecord` returns the parsed
 * JSON of a `*.run.json` path, or undefined when it no longer exists (a deletion is checked by path only).
 */
export function resultsGuardProblems(
  files: readonly string[],
  planIds: readonly string[],
  readRecord: (path: string) => unknown,
  externalPlanIds: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  const plans = new Set<string>();
  for (const f of [...new Set(files)].sort()) {
    if (!resultsPathAllowed(f, planIds)) {
      if (!v13ResultsPath(f, planIds)) problems.push(`${f}: not under results/pre-tag/, results/labels/, results/<registered plan id>/ or a v1.3, v1.4 or v1.5 result folder`);
      continue;
    }
    const top = f.split('/')[1] ?? '';
    if (top !== 'pre-tag' && top !== LABELS_RESULTS_DIR) plans.add(top);
  }
  for (const id of [...plans].sort()) {
    // ADR-036, ADR-038: a plan run by its own CLI (EXTERNAL_RUNNER_KINDS) writes no RunRecord; its scored summary
    // stands in for one.
    if (externalPlanIds.includes(id)) {
      if (!files.includes(`results/${id}/summary.json`)) problems.push(`results/${id}/: no summary.json (external-runner plan)`);
      continue;
    }
    const records = files.filter((f) => f.startsWith(`results/${id}/runs/`) && f.endsWith('.run.json'));
    const present = records.map((f) => [f, readRecord(f)] as const).filter(([, v]) => v !== undefined);
    if (present.length === 0) problems.push(`results/${id}/: no RunRecord under runs/`);
    for (const [f, v] of present) {
      const schema = validateRunRecord(v, ROOT);
      if (schema.length > 0) problems.push(`${f}: RunRecord schema: ${schema.join('; ')}`);
      else if ((v as { readonly planId?: unknown }).planId !== id) problems.push(`${f}: planId is not ${id}`);
    }
  }
  return problems;
}

function externalRunnerPlanIds(): string[] {
  return registeredPlanIds().filter((d) => {
    const kind = (JSON.parse(readFileSync(join(ROOT, 'experiments', d, 'plan.json'), 'utf8')) as { experiment?: string }).experiment;
    return (EXTERNAL_RUNNER_KINDS as readonly string[]).includes(kind ?? '');
  });
}

function registeredPlanIds(): string[] {
  return readdirSync(join(ROOT, 'experiments')).filter((d) => {
    try {
      return (JSON.parse(readFileSync(join(ROOT, 'experiments', d, 'plan.json'), 'utf8')) as { id?: unknown }).id === d;
    } catch {
      return false;
    }
  }).sort();
}

describe('results guard (BR-U5b-56, re-scoped by Build and Test Step 5)', () => {
  const lines = (t: string): string[] => t.split('\n').filter((l) => l.length > 0);

  it('origin/v1.2e resolves; every tracked or branch-changed results/ path is allowed', () => {
    expect(git('rev-parse', '--verify', 'origin/v1.2e^{commit}')).toMatch(/^[0-9a-f]{40}$/);
    const files = [...lines(git('ls-files', 'results/')), ...lines(git('diff', '--name-only', 'origin/v1.2e...HEAD', '--', 'results/'))];
    const read = (f: string): unknown => {
      try { return JSON.parse(readFileSync(join(ROOT, f), 'utf8')) as unknown; } catch { return undefined; }
    };
    expect(resultsGuardProblems(files, registeredPlanIds(), read, externalRunnerPlanIds())).toEqual([]);
  });

  it('allows pre-tag files, the label-plan directory and a registered plan directory with a schema-valid RunRecord', () => {
    const rec = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/reports/correct-reference.run.json'), 'utf8')) as Record<string, unknown>;
    const records: Record<string, unknown> = { 'results/latency-gate/runs/r1.run.json': { ...rec, planId: 'latency-gate' } };
    // results/labels/ is the runbook stage 6 label-plan directory (no RunRecord of its own).
    const files = ['results/pre-tag/fixtures-abc1234.json', 'results/pre-tag/README.md', 'results/latency-gate/runs/r1.run.json', 'results/latency-gate/latency.csv', 'results/labels/label-plan.json'];
    expect(resultsGuardProblems(files, registeredPlanIds(), (f) => records[f])).toEqual([]);
  });

  it('fails anything else: unregistered plan, top-level file, missing or invalid RunRecord, wrong planId', () => {
    const rec = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/reports/correct-reference.run.json'), 'utf8')) as Record<string, unknown>;
    const records: Record<string, unknown> = {
      'results/sensitivity/runs/bad.run.json': { ...rec, planId: 'sensitivity', attempt: 3 },
      'results/fixtures/runs/r.run.json': { ...rec, planId: 'latency-gate' },
    };
    const problems = resultsGuardProblems(
      ['results/unregistered/x.json', 'results/top.json', 'results/latency-gate/latency.csv', 'results/sensitivity/runs/bad.run.json', 'results/fixtures/runs/r.run.json'],
      registeredPlanIds(), (f) => records[f],
    ).join('\n');
    expect(problems).toMatch(/results\/unregistered\/x.json: not under/);
    expect(problems).toMatch(/results\/top.json: not under/);
    expect(problems).toMatch(/results\/latency-gate\/: no RunRecord/);
    expect(problems).toMatch(/bad.run.json: RunRecord schema/);
    expect(problems).toMatch(/r.run.json: planId is not fixtures/);
  });

  it('allows v1.3, v1.4 and v1.5 result folders by pattern and nothing that only resembles one; the v1.2E checks still apply', () => {
    const rec = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/reports/correct-reference.run.json'), 'utf8')) as Record<string, unknown>;
    const records: Record<string, unknown> = { 'results/sensitivity/runs/bad.run.json': { ...rec, planId: 'sensitivity', attempt: 3 } };
    const ok = ['results/v1.3/loop-fault-drills/drills.json', 'results/v1.3-reference/after-member-facts/report.json', 'results/v1.3-floor-probe-2/x.json', 'results/v1.4-u2/baseline.json', 'results/v1.4-drift-check/a.json', 'results/v1.5-graph-scale/a.json'];
    expect(resultsGuardProblems(ok, registeredPlanIds(), () => undefined)).toEqual([]);
    const bad = ['results/v1.30/x.json', 'results/v1.2e-x/a.json', 'results/v1.3-/a.json', 'results/V1.3-x/a.json', 'results/v1.3.json', 'results/v1.4/x.json', 'results/v1.5/x.json', 'results/v1.5-/a.json', 'results/v1.50-x/a.json', 'results/v1.4-/a.json', 'results/v1.40-x/a.json', 'results/sensitivity/runs/bad.run.json'];
    const problems = resultsGuardProblems(bad, registeredPlanIds(), (f) => records[f]).join('\n');
    for (const f of bad.slice(0, 8)) expect(problems).toContain(`${f}: not under`);
    expect(problems).toMatch(/bad.run.json: RunRecord schema/);
    // A v1.3-named folder that is a registered plan id keeps the plan's RunRecord check.
    expect(resultsGuardProblems(['results/v1.3-x/a.json'], ['v1.3-x'], () => undefined)).toEqual(['results/v1.3-x/: no RunRecord under runs/']);
  });
});

/** Every `.ts` file under `dir` (recursive), repo-relative. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts')) out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out.sort();
}

/** Offending lines: a `new GeminiProvider` or a value import of `GeminiProvider` (type-only imports allowed). */
export function liveGeminiUses(file: string, text: string): string[] {
  const bad: string[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/\bnew\s+GeminiProvider\b/.test(line)) bad.push(`${file}:${String(i + 1)}: constructs GeminiProvider`);
  });
  for (const m of text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]*gemini-provider(?:\.js)?['"]/g)) {
    if (m[1] !== undefined) continue;
    const names = (m[2] ?? '').split(',').map((n) => n.trim()).filter((n) => n !== '');
    if (names.some((n) => /^GeminiProvider\b/.test(n))) bad.push(`${file}: value import of GeminiProvider`);
  }
  return bad;
}

describe('no live Gemini in the scripts tests (BR-U5b-44)', () => {
  const GUARD = 'tests/unit/scripts/u5b/guards.test.ts';

  it('no file under tests/unit/scripts/** constructs GeminiProvider or imports it as a value', () => {
    const files = tsFiles(join(ROOT, 'tests/unit/scripts')).filter((f) => f !== GUARD);
    expect(files.length).toBeGreaterThan(30);
    expect(files.flatMap((f) => liveGeminiUses(f, readFileSync(join(ROOT, f), 'utf8')))).toEqual([]);
  });

  it('flags a construction and a value import, and accepts a type-only import', () => {
    const ctor = ['new', 'GeminiProvider'].join(' ');
    expect(liveGeminiUses('x.ts', `const p = ${ctor}({ apiKey: '', model: 'm', temperature: 0, maxTokens: 1 });`)).toHaveLength(1);
    expect(liveGeminiUses('x.ts', "import { GeminiProvider } from '../../src/llm-critic/gemini-provider.js';")).toHaveLength(1);
    expect(liveGeminiUses('x.ts', "import type { GeminiProvider } from '../../src/llm-critic/gemini-provider.js';")).toEqual([]);
    expect(liveGeminiUses('x.ts', "import { toGeminiResponseSchema } from '../../src/llm-critic/gemini-provider.js';")).toEqual([]);
  });
});
