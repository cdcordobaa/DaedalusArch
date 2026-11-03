/**
 * CAL-01 (development calibration, 2026-10-27; catalog `Docs/v1.5/ddd-detection-paths.md`). Zero model calls.
 * Each case is its domain's `base/` with the case folder overlaid (a case file replaces or adds a base file). Every
 * tree is checked by the v1.5 rules (`runTree`) and by the frozen file rules (`check_diff` on the whole tree against
 * nothing, blocking tier only). The frozen loader needs its full schema, so the frozen check uses P1's spec as the
 * template with the domain's own `ddd` block (minus `invariants`, a v1.5-only field) swapped in. A violation case passes when a rule mapped to its catalog row fires in the labelled
 * file; a clean case (twin, legit) passes when no mapped rule fires anywhere in the tree. CAL-01 is development
 * material: rules may be revised after reading it; the admission gate is CAL-02. Since instrument v1.5.3 a case is
 * scored with its domain's base as the baseline (`BuildOptions.baseline`), as the delivery hub takes the session's seed.
 *
 *   npx tsx experiments/cal-01/score.ts
 *
 * R-MIRROR-SEM's model fact: by default no judge is passed (the rule never fires; zero calls). `--judge live --ledger
 * <file.jsonl>` (HCAL-06 only, 2026-10-29) passes the hub's judge: the Claude CLI route, `claude-opus-5-5`, the same disk
 * cache by content hash; every real call is one line of the ledger and every judged candidate one line of
 * `<file>.judged.jsonl` (case, candidate, where the answer came from, the answer). `modelCalls` is then the real calls.
 * HCAL-07 (2026-10-29): labels may carry `row`, a reporting row (`H11-a` to `H11-d`, clean cases too); the record then
 * adds `reportRow` per case and `perReportRow` (recall and FP). Scoring itself is unchanged: a case scores against its
 * `rule`'s rules. HCAL-07 is scored from its scoring copy (`experiments/hcal-07/scoring-copy.ts`) with `--dir <copy>`.
 * HCAL-08 (2026-11-03): `--rows hcal08` uses the set's own row keys (`HCAL08_ROW_RULES`, written before any case was
 * scored, `experiments/hcal-08/README.md`, "Row map"). A row entry may name a shape, `RULE[shape]`: a hit then counts
 * only with that shape. R-MIRROR2's shape is the word its evidence starts with (`[word] …`); R-MIRROR-SEM's is the form
 * of its judged candidate, `C` for a core lookup's key set (`coreKind` 'keys', v1.5.10) and `A` otherwise. Hits carry
 * `shape` when it is known, and the judged record carries `coreKind`. Earlier sets score as before.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../src/mcp-server/context.js';
import { checkDiffTool } from '../../src/mcp-server/tools.js';
import YAML from 'yaml';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';
import { DDD_ROW_RULES, HEX_ROW_RULES } from '../../src/v15-instrument/rule-set.js';
import { cliCaller, createMirrorJudge, defaultCacheDir, MIRROR_SEM_MODEL, MIRROR_SEM_VERSION, type MirrorJudge } from '../../src/v15-instrument/mirror-sem.js';

// `--dir experiments/<set>` scores another set (CAL-02, HCAL-01); `--rows hex` uses the Hexagonal row map.
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const DIR = path.resolve(argOf('--dir') ?? path.join('experiments', 'cal-01'));
/** Catalog row → the rule ids that detect it: the one rule list (`src/v15-instrument/rule-set.ts`), re-exported. */
export const ROW_RULES: Readonly<Record<string, readonly string[]>> = DDD_ROW_RULES;
export { HEX_ROW_RULES };
/** HCAL-08's row keys → the rules (and shapes) that report them; fixed before any HCAL-08 case was scored. */
export const HCAL08_ROW_RULES: Readonly<Record<string, readonly string[]>> = {
  'HX8-WORD': ['R-MIRROR2[word]'],
  'HX8-SET': ['R-MIRROR-SEM[A]', 'R-MIRROR2[literal]', 'R-MIRROR2[error]'],
  'HX8-KEY': ['R-MIRROR-SEM[C]'],
  'HX8-EDGE': ['R-AXA', 'R-PURE', 'R-COREIO', 'R-D9', 'FF-S01', 'FF-S04', 'FF-P01'],
};
const ROWS: Readonly<Record<string, readonly string[]>> = argOf('--rows') === 'hex' ? HEX_ROW_RULES : argOf('--rows') === 'hcal08' ? HCAL08_ROW_RULES : ROW_RULES;
// Development runs: `--only K08,K12` scores those rows' cases (plus the base), `--out <file>` writes the record
// elsewhere, so a sealed set's result.json is never overwritten.
const ONLY = argOf('--only')?.split(',');
const OUT = argOf('--out');
const JUDGE = argOf('--judge');
const LEDGER = argOf('--ledger');
const matchOne = (h: Hit, i: string): boolean => {
  const q = /^([^[]+)\[([^\]]+)\]$/.exec(i);
  if (q !== null) return h.rule === q[1] && h.shape === q[2];
  return i.endsWith('*') ? h.rule.startsWith(i.slice(0, -1)) : h.rule === i;
};
const matches = (h: Hit, ids: readonly string[]): boolean => ids.some((i) => matchOne(h, i));
/** The shape word of an R-MIRROR2 finding (its evidence starts with `[shape]`), else undefined. */
const mirror2ShapeOf = (rule: string, evidence: string): string | undefined => (rule === 'R-MIRROR2' ? /^\[([a-z-]+)\]/.exec(evidence)?.[1] : undefined);

interface Label { rule: string; label: 'violation' | 'clean'; file: string | null; note: string; line?: number | null; subshape?: string | null; kind?: string; row?: string }
interface Hit { rule: string; file: string; line: number | null; shape?: string }

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

/** The live judge for one scoring (`--judge live`), with a per-candidate record of what it answered; null otherwise. */
function scoringJudge(where: { domain: string; case: string }, kinds: Map<string, string>): MirrorJudge | null {
  if (JUDGE === undefined) return null;
  if (JUDGE !== 'live' || LEDGER === undefined) throw new Error('--judge takes live and needs --ledger <file.jsonl>');
  const judged = LEDGER.replace(/\.jsonl$/, '') + '.judged.jsonl';
  fs.mkdirSync(path.dirname(path.resolve(LEDGER)), { recursive: true });
  const base = createMirrorJudge({ mode: 'live', caller: cliCaller(), cacheDir: defaultCacheDir(), ledger: path.resolve(LEDGER) });
  return {
    stats: base.stats,
    async judge(c) {
      const j = await base.judge(c);
      kinds.set(`${c.file}#${c.coreSet}`, c.coreKind);
      fs.appendFileSync(judged, `${JSON.stringify({ domain: where.domain, case: where.case, candidate: c.id, coreKind: c.coreKind, key: j.key.slice(0, 24), from: j.from, mirror: j.verdict?.mirror ?? null, reason: j.verdict?.reason ?? null })}\n`);
      return j;
    },
  };
}

async function main(): Promise<void> {
  const rules = loadRules();
  const where = { domain: '', case: '' };
  const kinds = new Map<string, string>(); // `file#coreSet` → coreKind of the candidates judged for the current tree
  const judge = scoringJudge(where, kinds);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cal01-'));
  const rows: Record<string, unknown>[] = [];
  for (const domain of fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, 'labels.json'))).sort()) {
    const dd = path.join(DIR, domain);
    const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, Label>;
    const trees: [string, string, Label | null][] = [['base', path.join(dd, 'base'), null], ...Object.entries(labels).filter(([, l]) => ONLY === undefined || ONLY.includes(l.rule)).sort().map(([c, l]) => [c, path.join(dd, 'cases', c), l] as [string, string, Label])];
    for (const [c, caseDir, lab] of trees) {
      const tree = path.join(scratch, domain, c);
      where.domain = domain; where.case = c; kinds.clear();
      fs.cpSync(path.join(dd, 'base'), tree, { recursive: true });
      if (c !== 'base') fs.cpSync(caseDir, tree, { recursive: true });
      const spec = fs.existsSync(path.join(tree, 'spec.yaml')) ? path.join(tree, 'spec.yaml') : path.join(dd, 'base', 'spec.yaml');
      // A case's seed is its domain's base: the base is the baseline (instrument v1.5.3, as the hub takes the session's
      // seed); the base itself has no seed and is scored without one, so its clean check keeps its meaning.
      const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s'), ...(c !== 'base' ? { baseline: path.join(dd, 'base') } : {}), ...(judge !== null ? { mirrorJudge: judge } : {}) });
      const shapeOf = (f: { rule: string; file: string; subject: string; evidence: string }): string | undefined => {
        if (f.rule === 'R-MIRROR2') return mirror2ShapeOf(f.rule, f.evidence);
        if (f.rule === 'R-MIRROR-SEM') { const k = kinds.get(`${f.file}#${f.subject}`); return k === undefined ? undefined : k === 'keys' ? 'C' : 'A'; }
        return undefined;
      };
      const hits: Hit[] = [...r.findings.filter((f) => f.status === 'violation').map((f) => { const sh = shapeOf(f); return { rule: f.rule, file: f.file, line: f.line, ...(sh !== undefined ? { shape: sh } : {}) }; }), ...(await frozenHits(tree, spec))];
      if (lab === null) { rows.push({ domain, case: c, row: null, label: 'clean', pass: hits.length === 0, hits }); continue; }
      const ids = ROWS[lab.rule] ?? [];
      const mapped = hits.filter((h) => matches(h, ids));
      const pass = lab.label === 'violation' ? mapped.some((h) => lab.file === null || h.file === lab.file || h.file.endsWith(lab.file)) : mapped.length === 0;
      // HCAL-06 labels add subshape and kind, HCAL-07 labels a reporting row (absent in earlier sets, so their records are unchanged)
      const extra = { ...(lab.subshape !== undefined ? { subshape: lab.subshape } : {}), ...(lab.kind !== undefined ? { kind: lab.kind } : {}), ...(lab.row !== undefined ? { reportRow: lab.row } : {}) };
      rows.push({ domain, case: c, row: lab.rule, label: lab.label, labelledFile: lab.file, ...extra, pass, mapped, other: hits.filter((h) => !matches(h, ids)) });
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const perRow: Record<string, { recall: string; fp: string }> = {};
  for (const k of Object.keys(ROWS).filter((r) => ONLY === undefined || ONLY.includes(r))) {
    const pos = rows.filter((x) => x.row === k && x.label === 'violation');
    const neg = rows.filter((x) => x.row === k && x.label === 'clean');
    perRow[k] = { recall: `${String(pos.filter((x) => x.pass).length)}/${String(pos.length)}`, fp: `${String(neg.filter((x) => !x.pass).length)}/${String(neg.length)}` };
  }
  // Recall per sub-shape (only when the labels carry one: HCAL-06)
  const perSubshape: Record<string, { recall: string }> = {};
  for (const x of rows.filter((y) => y.label === 'violation' && typeof y['subshape'] === 'string')) {
    const k = `${String(x.row)}/${String(x['subshape'])}`;
    const [ok, n] = (perSubshape[k]?.recall ?? '0/0').split('/').map(Number) as [number, number];
    perSubshape[k] = { recall: `${String(ok + (x.pass === true ? 1 : 0))}/${String(n + 1)}` };
  }
  // Recall and FP per reporting row (only when the labels carry `row`: HCAL-07). A row's cases score against their
  // `rule`'s rules as above (H11-a to H11-d all against H11); `row` only groups them, clean cases included.
  const perReportRow: Record<string, { recall: string; fp: string }> = {};
  for (const k of [...new Set(rows.map((x) => x['reportRow']).filter((r): r is string => typeof r === 'string'))].sort()) {
    const pos = rows.filter((x) => x['reportRow'] === k && x.label === 'violation');
    const neg = rows.filter((x) => x['reportRow'] === k && x.label === 'clean');
    perReportRow[k] = { recall: `${String(pos.filter((x) => x.pass).length)}/${String(pos.length)}`, fp: `${String(neg.filter((x) => !x.pass).length)}/${String(neg.length)}` };
  }
  const sem = judge === null ? {} : { mirrorSem: { mode: 'live', version: MIRROR_SEM_VERSION, model: MIRROR_SEM_MODEL, ...judge.stats } };
  const subs = Object.keys(perSubshape).length > 0 ? { perSubshape: Object.fromEntries(Object.entries(perSubshape).sort()) } : {};
  const reps = Object.keys(perReportRow).length > 0 ? { perReportRow } : {};
  fs.writeFileSync(OUT ?? path.join(DIR, 'result.json'), `${JSON.stringify({ modelCalls: judge?.stats.calls ?? 0, ...sem, perRow, ...subs, ...reps, rows }, null, 2)}\n`);
  for (const [k, v] of Object.entries(perRow)) process.stdout.write(`${k} recall ${v.recall} fp ${v.fp}\n`);
  for (const [k, v] of Object.entries(perSubshape)) process.stdout.write(`${k} recall ${v.recall}\n`);
  for (const [k, v] of Object.entries(perReportRow)) process.stdout.write(`report row ${k} recall ${v.recall} fp ${v.fp}\n`);
  if (judge !== null) process.stdout.write(`R-MIRROR-SEM judge: ${JSON.stringify(judge.stats)}\n`);
  for (const x of rows.filter((y) => y.row === null)) process.stdout.write(`${String(x.domain)} base: ${(x.hits as Hit[]).map((h) => `${h.rule} ${h.file}:${String(h.line)}`).join(' | ') || 'clean'}\n`);
}
if (process.argv[1]?.endsWith("score.ts")) void main();
