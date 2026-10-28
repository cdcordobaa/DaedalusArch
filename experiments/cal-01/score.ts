/**
 * CAL-01 (development calibration, 2026-10-27; catalog `Docs/v1.5/ddd-detection-paths.md`). Zero model calls.
 * Each case is its domain's `base/` with the case folder overlaid (a case file replaces or adds a base file). Every
 * tree is checked by the v1.5 rules (`runTree`) and by the frozen file rules (`check_diff` on the whole tree against
 * nothing, blocking tier only). The frozen loader needs its full schema, so the frozen check uses P1's spec as the
 * template with the domain's own `ddd` block (minus `invariants`, a v1.5-only field) swapped in. A violation case passes when a rule mapped to its catalog row fires in the labelled
 * file; a clean case (twin, legit) passes when no mapped rule fires anywhere in the tree. CAL-01 is development
 * material: rules may be revised after reading it; the admission gate is CAL-02.
 *
 *   npx tsx experiments/cal-01/score.ts
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../src/mcp-server/context.js';
import { checkDiffTool } from '../../src/mcp-server/tools.js';
import YAML from 'yaml';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';

// `--dir experiments/<set>` scores another set (CAL-02, HCAL-01); `--rows hex` uses the Hexagonal row map.
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const DIR = path.resolve(argOf('--dir') ?? path.join('experiments', 'cal-01'));
/** Catalog row → the rule ids that detect it (v1.5 Cypher ids, or a frozen rule-id prefix ending in `*`). */
export const ROW_RULES: Record<string, readonly string[]> = {
  K01: ['FF-DS02'], K02: ['FF-DT04', 'FF-S01', 'FF-S03', 'R-H5', 'R-PURE'], K03: ['R-D4'], K04: ['R-D4', 'R-D4R'], K05: ['R-XCTX', 'R-D4'], K06: ['R-D4', 'R-XCTX'],
  K07: ['R-RTX'], K08: ['R-D5'], K09: ['R-D5'], K10: ['R-D5S', 'R-D5'], K11: ['R-LOCK'], K12: ['R-D3'], K13: ['R-H5'],
  K14: ['R-D9'], K15: ['R-INJ'], K16: ['R-REF'],
};
/** Hexagonal rows (HCAL), mapped by construct from the spec's fitness functions before scoring (2026-10-27). */
export const HEX_ROW_RULES: Record<string, readonly string[]> = {
  H01: ['FF-S01', 'FF-S04', 'FF-P01'], H02: ['FF-S01', 'FF-S03', 'FF-P02', 'R-INJ'], H03: ['FF-S01', 'FF-S03', 'FF-P03', 'R-AXA'],
  H04: ['R-H5'], H05: ['R-INJ', 'FF-P02'], H06: ['R-D5', 'R-D3'], H07: ['FF-P01', 'FF-S01', 'R-TRANSPORT'],
  H08: ['R-LOCATOR'], H09: ['R-COREIO'], H10: ['R-ENTITY-OUT'],
};
const ROWS: Record<string, readonly string[]> = argOf('--rows') === 'hex' ? HEX_ROW_RULES : ROW_RULES;
// Development runs: `--only K08,K12` scores those rows' cases (plus the base), `--out <file>` writes the record
// elsewhere, so a sealed set's result.json is never overwritten.
const ONLY = argOf('--only')?.split(',');
const OUT = argOf('--out');
const matches = (rule: string, ids: readonly string[]): boolean => ids.some((i) => (i.endsWith('*') ? rule.startsWith(i.slice(0, -1)) : rule === i));

interface Label { rule: string; label: 'violation' | 'clean'; file: string | null; note: string }
interface Hit { rule: string; file: string; line: number | null }

const TEMPLATE = 'experiments/puzzle-01/puzzles/p1-transfers/spec.yaml';
export function frozenSpec(spec: string, out: string): string {
  const d = YAML.parse(fs.readFileSync(spec, 'utf8')) as { architecture: { ddd: Record<string, unknown> }; scoring?: unknown };
  if (d.scoring !== undefined) { // already a full frozen-format spec: only the v1.5-only `invariants` field goes
    const full = YAML.parse(fs.readFileSync(spec, 'utf8')) as { architecture: { ddd?: Record<string, unknown> } };
    if (full.architecture.ddd) delete full.architecture.ddd['invariants'];
    fs.writeFileSync(out, YAML.stringify(full));
    return out;
  }
  const t = YAML.parse(fs.readFileSync(TEMPLATE, 'utf8')) as { architecture: Record<string, unknown> };
  const ddd = { ...d.architecture.ddd }; delete ddd['invariants'];
  // The frozen binder takes inner entities as paths inside the context; the v1.5 reader also takes class names.
  // A name is turned into a path glob under its aggregate's module (the binder rejects the whole model otherwise,
  // which switches every frozen DDD rule off without a message).
  ddd['aggregates'] = ((ddd['aggregates'] as { module: string; inner_entities?: string[] }[] | undefined) ?? []).map((a) => ({
    ...a, inner_entities: (a.inner_entities ?? []).map((e) => (e.includes('/') ? e : `${a.module.replace(/\*\*$/, '')}**/${e}.ts`)),
  }));
  t.architecture['ddd'] = { ...(t.architecture['ddd'] as Record<string, unknown>), ...ddd };
  fs.writeFileSync(out, YAML.stringify(t));
  return out;
}

export async function frozenHits(root: string, specIn: string): Promise<Hit[]> {
  const spec = frozenSpec(specIn, path.join(path.dirname(root), `${path.basename(root)}.frozen.yaml`));
  const files = execFileSync('find', ['src', '-name', '*.ts'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const diff = files.map((f) => {
    const body = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
    return `--- /dev/null\n+++ b/${f}\n@@ -0,0 +1,${String(body.length)} @@\n${body.map((l) => `+${l}`).join('\n')}\n`;
  }).join('');
  const ctx = buildContext(parseArgs(['--spec', spec, '--project', root, '--engine', 'cypher-interp']), {});
  const r = await checkDiffTool(ctx, { diff });
  if (!r.ok) throw new Error(`frozen check_diff refused ${root}: ${r.message}`);
  return r.data.files.flatMap((f) => f.findings.filter((v) => v.tier === 'blocking').map((v) => ({ rule: v.ruleId, file: f.path, line: v.line })));
}

async function main(): Promise<void> {
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cal01-'));
  const rows: Record<string, unknown>[] = [];
  for (const domain of fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, 'labels.json'))).sort()) {
    const dd = path.join(DIR, domain);
    const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, Label>;
    const trees: [string, string, Label | null][] = [['base', path.join(dd, 'base'), null], ...Object.entries(labels).filter(([, l]) => ONLY === undefined || ONLY.includes(l.rule)).sort().map(([c, l]) => [c, path.join(dd, 'cases', c), l] as [string, string, Label])];
    for (const [c, caseDir, lab] of trees) {
      const tree = path.join(scratch, domain, c);
      fs.cpSync(path.join(dd, 'base'), tree, { recursive: true });
      if (c !== 'base') fs.cpSync(caseDir, tree, { recursive: true });
      const spec = fs.existsSync(path.join(tree, 'spec.yaml')) ? path.join(tree, 'spec.yaml') : path.join(dd, 'base', 'spec.yaml');
      const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s') });
      const hits: Hit[] = [...r.findings.filter((f) => f.status === 'violation').map((f) => ({ rule: f.rule, file: f.file, line: f.line })), ...(await frozenHits(tree, spec))];
      if (lab === null) { rows.push({ domain, case: c, row: null, label: 'clean', pass: hits.length === 0, hits }); continue; }
      const ids = ROWS[lab.rule] ?? [];
      const mapped = hits.filter((h) => matches(h.rule, ids));
      const pass = lab.label === 'violation' ? mapped.some((h) => lab.file === null || h.file === lab.file || h.file.endsWith(lab.file)) : mapped.length === 0;
      rows.push({ domain, case: c, row: lab.rule, label: lab.label, labelledFile: lab.file, pass, mapped, other: hits.filter((h) => !matches(h.rule, ids)) });
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const perRow: Record<string, { recall: string; fp: string }> = {};
  for (const k of Object.keys(ROWS).filter((r) => ONLY === undefined || ONLY.includes(r))) {
    const pos = rows.filter((x) => x.row === k && x.label === 'violation');
    const neg = rows.filter((x) => x.row === k && x.label === 'clean');
    perRow[k] = { recall: `${String(pos.filter((x) => x.pass).length)}/${String(pos.length)}`, fp: `${String(neg.filter((x) => !x.pass).length)}/${String(neg.length)}` };
  }
  fs.writeFileSync(OUT ?? path.join(DIR, 'result.json'), `${JSON.stringify({ modelCalls: 0, perRow, rows }, null, 2)}\n`);
  for (const [k, v] of Object.entries(perRow)) process.stdout.write(`${k} recall ${v.recall} fp ${v.fp}\n`);
  for (const x of rows.filter((y) => y.row === null)) process.stdout.write(`${String(x.domain)} base: ${(x.hits as Hit[]).map((h) => `${h.rule} ${h.file}:${String(h.line)}`).join(' | ') || 'clean'}\n`);
}
if (process.argv[1]?.endsWith("score.ts")) void main();
