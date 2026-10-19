/**
 * EFF-01 optional local check (design §6, DR-15): export each repo tree exactly as the driver does, run
 * `evaluate_project` on it in process (`--engine cypher-interp`, no database, no model call), and require the
 * violation counts of the committed reports (note §3: 23 and 102). The result goes to `<run dir>/local-check.json`; a
 * live run refuses to start unless that file shows a pass on the same tree fingerprints.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { buildContext, parseArgs } from '../../../../src/mcp-server/context.js';
import { evaluateProjectTool } from '../../../../src/mcp-server/tools.js';
import { loadEff01Inputs } from './inputs.js';
import { redactPaths, redactRoots } from './redact.js';
import { checkPin, exportTree, treeFingerprint } from './trees.js';

export const LOCAL_CHECK_FILE = 'local-check.json';

/** Violation counts of the committed reports (`results/v1.3-external/findings/<id>.json`; note §3). */
export const EXPECTED_VIOLATIONS: Readonly<Record<string, number>> = Object.freeze({ 'event-sourcing-ddd': 23, 'ddd-forum': 102 });

export interface LocalCheckTree {
  readonly fingerprint: string;
  readonly violationCount: number | null;
  readonly expected: number | null;
  readonly ok: boolean;
  readonly error?: string;
}

export interface LocalCheck {
  readonly schema: 'eff-01-local-check/v1';
  readonly engine: 'cypher-interp';
  readonly pass: boolean;
  readonly trees: Readonly<Record<string, LocalCheckTree>>;
}

export interface LocalCheckOptions {
  readonly repoRoot: string;
  readonly harness: string;
  readonly clones: string;
  readonly out: string;
  readonly runner: ProcessRunner;
  readonly env?: NodeJS.ProcessEnv;
}

export async function runLocalCheck(o: LocalCheckOptions): Promise<DomainResult<LocalCheck>> {
  const loaded = loadEff01Inputs(o.repoRoot);
  if (!loaded.success) return DomainResult.fail(loaded.errors);
  const plainEnv = { PATH: (o.env ?? process.env).PATH ?? '/usr/bin:/bin' };
  const trees: Record<string, LocalCheckTree> = {};
  for (const repo of loaded.data.repos) {
    const clone = path.join(o.clones, repo.id);
    const pin = await checkPin(o.runner, clone, repo.sha, plainEnv);
    if (!pin.success) return DomainResult.fail(pin.errors);
    const dest = path.join(o.harness, 'trees', repo.id);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const ex = await exportTree(o.runner, clone, repo.sha, dest, plainEnv);
    if (!ex.success) return DomainResult.fail(ex.errors);
    const ctx = buildContext(parseArgs(['--spec', path.join(o.repoRoot, repo.spec), '--project', dest, '--engine', 'cypher-interp']), {});
    const r = await evaluateProjectTool(ctx, {});
    const expected = EXPECTED_VIOLATIONS[repo.id] ?? null;
    const count = r.ok ? r.data.violationCount : null;
    trees[repo.id] = {
      fingerprint: treeFingerprint(dest),
      violationCount: count,
      expected,
      ok: count !== null && count === expected,
      ...(r.ok ? {} : { error: r.message }),
    };
  }
  const check: LocalCheck = { schema: 'eff-01-local-check/v1', engine: 'cypher-interp', pass: Object.values(trees).every((t) => t.ok), trees };
  fs.mkdirSync(o.out, { recursive: true });
  const home = (o.env ?? process.env).HOME;
  const roots = redactRoots({ harnessRoot: o.harness, repoRoot: o.repoRoot, clonesDir: o.clones, ...(home !== undefined ? { home } : {}) });
  fs.writeFileSync(path.join(o.out, LOCAL_CHECK_FILE), `${JSON.stringify(redactPaths(check, roots), null, 1)}\n`);
  return DomainResult.ok(check);
}

/** The live gate on the local check: a pass on the same tree fingerprints (design §6). Null when it holds. */
export function localCheckProblem(runDir: string, fingerprints: Readonly<Record<string, string>>): string | null {
  const file = path.join(runDir, LOCAL_CHECK_FILE);
  if (!fs.existsSync(file)) return `${LOCAL_CHECK_FILE} is missing (run scripts/v1.3/eff-01-local-check.ts first)`;
  const c = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LocalCheck>;
  if (c.pass !== true) return `${LOCAL_CHECK_FILE} does not show a pass`;
  for (const [id, fp] of Object.entries(fingerprints)) {
    if (c.trees?.[id]?.fingerprint !== fp) return `${LOCAL_CHECK_FILE} was taken on a different tree for ${id}`;
  }
  return null;
}
