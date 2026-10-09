/**
 * `so4-plan-entries`: writes the seeded entries of an SO4 plan from a U5a manifest (ADR-021 item 9, SO4-04; P-U6
 * runbook). The pure rule is `scripts/lib/so4-plan-entries.ts`; this file reads the plan and the manifest, validates
 * the result against the plan schema and writes it. The written plan is a registered artefact: it is committed and
 * registered by a dated pre-registration bump before the first so4-heldout run (analysis plan §2).
 */
import { resolve } from 'node:path';
import { loadManifest } from './lib/manifest.js';
import { SO4_PLAN_BASELINE_MISSING, seededPlan } from './lib/so4-plan-entries.js';
import type { So4PlanLike } from './lib/so4-plan-entries.js';
import { loadPlan } from './run-experiment.js';

export const SO4_PLAN_ENTRIES_USAGE = [
  'usage: npx tsx scripts/so4-plan-entries-cli.ts --plan <plan.json> --manifest <manifest.json> --copies <seeded copies root> --out <plan.json>',
  '       npx tsx scripts/so4-plan-entries-cli.ts --self-test | --help',
  '',
  'Keeps the plan\'s baseline entries and writes one seeded entry per manifest row after them: the copy',
  '<copies>/<projectId>/<operatorId>/k-<k>, the baseline\'s spec, and a seed reference whose baselineReportPath is',
  'reports/<runId of the baseline entry>.json (ADR-021 item 9). --manifest and --copies are written as given.',
  `Exit: 0 written; 1 refused (${SO4_PLAN_BASELINE_MISSING}, SO4_PLAN_SPEC_MISMATCH, SO4_PLAN_SEED_INVALID, PLAN_INVALID); 2 usage.`,
  '',
].join('\n');

export interface So4PlanEntriesIo {
  out(text: string): void;
  err(text: string): void;
  writeFile(path: string, text: string): void;
}

export function main(argv: readonly string[], repoRoot: string, io: So4PlanEntriesIo): number {
  if (argv.includes('--help')) {
    io.out(SO4_PLAN_ENTRIES_USAGE);
    return 0;
  }
  if (argv.includes('--self-test')) {
    // Known-bad input: a manifest row whose base has no baseline entry must be refused.
    const r = seededPlan({ id: 'self-test', projects: [] } satisfies So4PlanLike, [
      { seedId: 'p:MO-S01:0', projectId: 'p', operatorId: 'MO-S01', split: 'held-out', baseKind: 'corpus', specPath: 'corpus/specs/p.yaml' },
    ], { copiesRoot: 'c', manifestPath: 'm.json' });
    io.err(`self-test: ${r.ok ? 'a row without a baseline entry was accepted' : r.detail}\n`);
    return 1;
  }
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i] ?? '';
    const v = argv[i + 1];
    if (!['--plan', '--manifest', '--copies', '--out'].includes(a) || v === undefined || v.startsWith('--')) {
      io.err(`${a === '' ? 'missing arguments' : `bad argument ${a}`}\n${SO4_PLAN_ENTRIES_USAGE}`);
      return 2;
    }
    args.set(a.slice(2), v);
  }
  const [planPath, manifestPath, copies, out] = ['plan', 'manifest', 'copies', 'out'].map((k) => args.get(k));
  if (planPath === undefined || manifestPath === undefined || copies === undefined || out === undefined) {
    io.err(`--plan, --manifest, --copies and --out are required\n${SO4_PLAN_ENTRIES_USAGE}`);
    return 2;
  }
  const loaded = loadPlan(resolve(repoRoot, planPath), repoRoot);
  if (!loaded.ok) {
    io.err(`${loaded.code}: ${loaded.detail}\n`);
    return 1;
  }
  const manifest = loadManifest(repoRoot, resolve(repoRoot, manifestPath));
  if (!manifest.success) {
    io.err(`${manifest.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}\n`);
    return 1;
  }
  const r = seededPlan(loaded.plan, manifest.data.rows, { copiesRoot: copies, manifestPath });
  if (!r.ok) {
    io.err(`${r.detail}\n`);
    return 1;
  }
  const text = `${JSON.stringify(r.plan, null, 2)}\n`;
  io.writeFile(resolve(repoRoot, out), text);
  // The written plan must still validate (seed references against the run-record schema).
  const check = loadPlan(resolve(repoRoot, out), repoRoot);
  if (!check.ok) {
    io.err(`${check.code}: ${check.detail}\n`);
    return 1;
  }
  io.out(`${out}: ${String(r.baselines)} baseline entries, ${String(r.seeded)} seeded entries\n`);
  return 0;
}
