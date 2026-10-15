/**
 * ISE on E1, POST-HOC supplement (decided after the primary ICS came out at 1.000 in every cell; exploratory, not in
 * §1 of Docs/DiagnosticRuns/ise-e1-ics-2026-10-15.md). Style-free self-consistency from ISE Option 1 (majority vote)
 * on each accepted E1 cell's own graph: every mined rule that applies (support >= 0.6) is applied back to the same
 * graph, and the instances that break it are the cell's self-deviations. The closed-world allowlist is skipped
 * (support 1 by construction). Offline: no Neo4j, no evaluation.
 *
 * The snapshot is built exactly as in `ise-e1.ts` (src/ + pinned tsconfig + skeleton node_modules symlink).
 * Entry file: exports only the pure `selfDeviations` (unit-tested).
 *
 * Usage: npx tsx scripts/v1.3/ise-e1-option1.ts --e1-runs results/e1-grid/runs --e1-root <outcomes> --out results/v1.3-ise-e1
 * Writes <out>/option1.json and <out>/option1.md.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyRules, boundedContexts, detectSourceRoot, inferSpec, unitStructure } from '../../src/ise/index.js';
import type { IseGraph, RuleCandidate } from '../../src/ise/index.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';

export interface RuleSelfCheck {
  readonly id: string;
  readonly kind: string;
  readonly statement: string;
  readonly support: number;
  readonly instances: number;
  readonly applies: boolean;
  /** Deviating instances; null for a rule that does not apply (support < 0.6). */
  readonly deviations: number | null;
}

/** Applies each applying, non-closed-world rule back to the graph it was mined on (non-applying ones are kept, unapplied). */
export function selfDeviations(graph: IseGraph, rules: readonly RuleCandidate[]): RuleSelfCheck[] {
  const contexts = new Set(boundedContexts(graph.files, detectSourceRoot(graph.files)));
  const units = unitStructure(graph, (id) => contexts.has(id)).units;
  return rules
    .filter((r) => r.kind !== 'closed-world' && r.instances > 0)
    .map((r) => ({ id: r.id, kind: r.kind, statement: r.statement, support: r.support, instances: r.instances, applies: r.applies, deviations: r.applies ? applyRules([r], graph, units).length : null }));
}

const KINDS = ['direction', 'acyclic', 'inject-interfaces', 'implements-port', 'framework-free', 'decorator-free'] as const;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const arg = (n: string): string => {
    const v = argv[argv.indexOf(`--${n}`) + 1];
    if (!argv.includes(`--${n}`) || v === undefined) throw new Error(`--${n} is required`);
    return v;
  };
  const runsDir = path.resolve(arg('e1-runs'));
  const e1Root = path.resolve(arg('e1-root'));
  const outDir = path.resolve(arg('out'));
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v13-ise-e1-o1-')));
  const cells: { id: string; model: string; level: string; files: number; rules: RuleSelfCheck[] }[] = [];
  try {
    for (const name of fs.readdirSync(runsDir).filter((n) => n.endsWith('.run.json')).sort()) {
      const rec = JSON.parse(fs.readFileSync(path.join(runsDir, name), 'utf8')) as { projectId?: string; status?: string };
      if (rec.status !== 'accepted' || rec.projectId === undefined) continue;
      const id = rec.projectId.replace(/\//g, '_');
      const [model = '', , level = ''] = rec.projectId.split('/');
      const src = path.join(e1Root, rec.projectId);
      const holder = fs.mkdtempSync(path.join(work, 'ise-snap-'));
      const snap = path.join(holder, 'project');
      fs.mkdirSync(snap);
      fs.cpSync(path.join(src, 'src'), path.join(snap, 'src'), { recursive: true });
      const nm = path.join(src, 'node_modules');
      if (fs.existsSync(nm)) fs.symlinkSync(fs.realpathSync(nm), path.join(snap, 'node_modules'));
      fs.writeFileSync(path.join(snap, 'tsconfig.json'), harnessTsconfigText(snap));
      try {
        const inf = await inferSpec(snap, { presetsDir: path.join(process.cwd(), 'presets') });
        cells.push({ id, model, level, files: inf.graph.files.length, rules: selfDeviations(inf.graph, inf.majorityVote) });
      } finally {
        fs.rmSync(holder, { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(outDir, 'option1.json'), `${JSON.stringify(cells, null, 1)}\n`);

  const out: string[] = ['# ISE on E1: Option 1 self-deviations (POST-HOC, exploratory; scripts/v1.3/ise-e1-option1.ts)', ''];
  out.push('Per spec level × model: cells; for each rule kind (applying rules only), `partial/applying` = applying rules with support below 1 (followed by the majority but broken somewhere in the same cell) over all applying rules, and the deviating instances over all instances; then the cells with at least one partial rule outside `framework-free`, and the pooled self-deviation rate outside `framework-free`.', '');
  out.push(`| Spec level | Model | Cells | ${KINDS.map((k) => `${k} partial/applying (dev/inst)`).join(' | ')} | Cells with a partial rule (excl. framework-free) | Self-deviation rate (excl. framework-free) |`);
  out.push(`|---|---|---|${KINDS.map(() => '---|').join('')}---|---|`);
  const models = [...new Set(cells.map((c) => c.model))].sort();
  for (const level of ['none', 'minimal-prose', 'full-aac']) {
    for (const model of [...models, 'all']) {
      const cs = cells.filter((c) => c.level === level && (model === 'all' || c.model === model));
      const cols = KINDS.map((k) => {
        const rs = cs.flatMap((c) => c.rules.filter((r) => r.kind === k && r.applies));
        return `${String(rs.filter((r) => r.support < 1).length)}/${String(rs.length)} (${String(rs.reduce((s, r) => s + (r.deviations ?? 0), 0))}/${String(rs.reduce((s, r) => s + r.instances, 0))})`;
      });
      const core = cs.map((c) => c.rules.filter((r) => r.kind !== 'framework-free' && r.applies));
      const withPartial = core.filter((rs) => rs.some((r) => r.support < 1)).length;
      const dev = core.flat().reduce((s, r) => s + (r.deviations ?? 0), 0);
      const inst = core.flat().reduce((s, r) => s + r.instances, 0);
      const b = model === 'all' ? (s: string): string => `**${s}**` : (s: string): string => s;
      out.push(`| ${b(level)} | ${b(model.replace(/^claude-/, ''))} | ${String(cs.length)} | ${cols.join(' | ')} | ${String(withPartial)}/${String(cs.length)} | ${inst === 0 ? 'n/a' : (dev / inst).toFixed(3)} |`);
    }
  }
  out.push('', '## Partial rules per cell (support < 1, excl. framework-free)', '');
  for (const c of cells) {
    const p = c.rules.filter((r) => r.support < 1 && r.kind !== 'framework-free');
    if (p.length > 0) out.push(`- **${c.id}**: ${p.map((r) => `${r.kind}: ${r.statement} ${r.applies ? `[${String(r.deviations)} dev]` : '[below 0.6: no majority, not a rule]'}`).join('; ')}`);
  }
  fs.writeFileSync(path.join(outDir, 'option1.md'), `${out.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('ise-e1-option1.ts') === true) {
  void main().then((c) => { process.exitCode = c; }, (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 2;
  });
}
