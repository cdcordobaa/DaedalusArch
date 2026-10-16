/**
 * `audit-sheet.ts union` and `audit-sheet.ts union-agreement` (Docs/v1.3/human-labelling-protocol.md §2–§6).
 *
 * union --run <run dir> --materialise <dir> --seed <n> --sheet-out <sheet.md> --key-out <key.json>
 *       [--n 60|120] [--root <reference dir>] [--id-map <file>] [--style a,b] [--decoys-per-case 1|2]
 *       [--negative-share 0.25] [--tiers blocking|all] [--cases-out <anything-else.md>]
 *       [--sample-out <union-sample.json> --jobs-out <union-jobs.json>]   (inputs for label-meaningful.ts)
 *   <run dir> holds raw/<style>/<variant>.json (validate-reference) and, optionally, graph/tool-graphs.json (ue-graph,
 *   for the layer of a file the reference graph does not list). Every variant is materialised under --materialise.
 *
 * union-agreement --key <key.json> --raters <name>=<answers.md|csv>,<name>=<…> [--model <name>=<labels.json>[+<labels2.json>]]
 *       --out <agreement.json> [--md-out <agreement.md>]
 *   The first rater is the primary human reference. A `.csv` answers file has the columns itemId,answer,note.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { materialiseVariant } from '../materialise.js';
import { REFERENCE_ROOT, applyRuleIdMap, isReferenceStyle, loadAllReferences, loadRuleIdMap } from '../reference-model.js';
import type { ActualFinding } from '../compare.js';
import type { MeaningfulItemLabel } from './meaningful.js';
import type { LabellingJob } from './findings.js';
import {
  ANYTHING_ELSE_CASES, DEFAULT_NEGATIVE_SHARE, UNION_SIZES, anythingElseSheet, buildCaseItems, caseId, caseLabels, parseUnionAnswers,
  renderUnionAgreement, selectCases, selectUnion, unionAgreement, unionAsSampled, unionKeyRows, unionSheet,
} from './union.js';
import type { UnionItem, UnionKeyRow } from './union.js';

export interface UnionIo {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
}

function need(args: ReadonlyMap<string, string>, name: string): string {
  const v = args.get(name);
  if (v === undefined || v === 'true') throw new Error(`--${name} <value> is required`);
  return v;
}

function writeFile(file: string, text: string): void {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, text);
}

const writeJson = (file: string, v: unknown): void => { writeFile(file, `${JSON.stringify(v, null, 2)}\n`); };
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

function listTs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith('.ts')) out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  walk(path.join(root, 'src'));
  return out.sort();
}

export function unionSheetMain(args: ReadonlyMap<string, string>, repoRoot: string, io: UnionIo): number {
  const runDir = path.resolve(need(args, 'run'));
  const dest = path.resolve(need(args, 'materialise'));
  const seed = Number(need(args, 'seed'));
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('--seed must be a non-negative integer');
  const n = Number(args.get('n') ?? '60');
  if (!Number.isInteger(n) || n <= 0) throw new Error('--n must be a positive integer');
  if (!(UNION_SIZES as readonly number[]).includes(n)) io.err(`warning: --n ${String(n)} is neither option A (60) nor option B (120) of protocol §3\n`);
  const decoysPerCase = Number(args.get('decoys-per-case') ?? '2');
  if (decoysPerCase !== 1 && decoysPerCase !== 2) throw new Error('--decoys-per-case must be 1 or 2');
  const share = Number(args.get('negative-share') ?? String(DEFAULT_NEGATIVE_SHARE));
  if (!(share >= 0 && share < 1)) throw new Error('--negative-share must be in [0, 1)');
  const tiers = args.get('tiers') ?? 'blocking';
  if (tiers !== 'blocking' && tiers !== 'all') throw new Error('--tiers must be blocking or all');
  const styleArg = args.get('style');
  const styles = styleArg?.split(',').filter((s) => s !== '');
  if (styles !== undefined && !styles.every(isReferenceStyle)) throw new Error('--style takes reference styles');
  const map = args.has('id-map') ? loadRuleIdMap(path.resolve(need(args, 'id-map'))) : undefined;
  const refs = loadAllReferences(repoRoot, styles, args.get('root') ?? REFERENCE_ROOT).map((r) => applyRuleIdMap(r, map).ref);
  const graphFile = path.join(runDir, 'graph', 'tool-graphs.json');
  const toolGraphs = fs.existsSync(graphFile) ? readJson<Record<string, Record<string, { files: { file: string; layer: string | null }[] }>>>(graphFile) : {};

  const all: UnionItem[] = [];
  const roots = new Map<string, string>();
  const jobs: LabellingJob[] = [];
  let shortfall = 0;
  for (const ref of refs) {
    const refLayer = new Map(ref.graph.files.map((f) => [f.path, f.layer]));
    for (const v of ref.variants) {
      const rawFile = path.join(runDir, 'raw', ref.style, `${v.manifest.variant}.json`);
      if (!fs.existsSync(rawFile)) throw new Error(`no tool output ${rawFile}`);
      const tool = readJson<{ findings: ActualFinding[] }>(rawFile).findings;
      const m = materialiseVariant(ref, v, dest);
      const projectId = `${ref.style}/${v.manifest.variant}`;
      roots.set(projectId, m.projectDir);
      const sources = new Map(listTs(m.projectDir).map((f) => [f, fs.readFileSync(path.join(m.projectDir, f), 'utf8')]));
      const toolLayer = new Map((toolGraphs[ref.style]?.[v.manifest.variant]?.files ?? []).map((f) => [f.file, f.layer]));
      const layerOf = (f: string): string | null => (refLayer.has(f) ? refLayer.get(f) ?? null : toolLayer.get(f) ?? null);
      const built = buildCaseItems({ ref, variant: v.manifest.variant, tool, sources, layerOf }, { seed, decoysPerCase: decoysPerCase, tiers });
      shortfall += built.decoyShortfall;
      all.push(...built.items);
      jobs.push({ projectId, projectRoot: m.projectDir, spec: ref.specPath, report: rawFile, style: ref.style });
    }
  }
  const draw = selectUnion(all, n, seed, share);
  const cases = selectCases(draw.items, seed, ANYTHING_ELSE_CASES);
  const read = (pid: string, f: string): string | null => {
    const root = roots.get(pid);
    try { return root === undefined ? null : fs.readFileSync(path.join(root, f), 'utf8'); } catch { return null; }
  };
  const sheetOut = need(args, 'sheet-out');
  const labels = caseLabels(draw.items, seed);
  writeFile(sheetOut, unionSheet(draw.items, (it) => read(it.projectId, it.file), labels));
  const casesOut = args.get('cases-out') ?? sheetOut.replace(/\.md$/, '') + '.anything-else.md';
  writeFile(casesOut, anythingElseSheet(draw.items, cases, (pid) => listTs(roots.get(pid) ?? ''), read, labels));
  const population: Record<string, number> = {};
  for (const it of all) population[`${it.style}/${it.source}`] = (population[`${it.style}/${it.source}`] ?? 0) + 1;
  writeJson(need(args, 'key-out'), {
    schemaVersion: 1, mode: 'union', seed, n, size: draw.items.length, negativeShare: share, negatives: draw.negatives,
    tiers, decoysPerCase, decoyShortfall: shortfall, population, allocation: draw.allocation, warnings: draw.warnings,
    cases: Object.fromEntries([...labels].map(([pid, label]) => [label, pid])),
    anythingElse: cases.map((pid, i) => ({ caseId: labels.get(pid) ?? caseId(i), projectId: pid })),
    rows: unionKeyRows(draw.items),
  });
  if (args.has('sample-out')) {
    writeJson(need(args, 'sample-out'), { schemaVersion: 1, seed, cap: n, tiers: 'all', excludedNotApplicable: {}, rules: [], items: unionAsSampled(draw.items) });
    writeJson(need(args, 'jobs-out'), { schemaVersion: 1, kind: 'custom', jobs });
  }
  for (const w of draw.warnings) io.err(`warning: ${w}\n`);
  if (shortfall > 0) io.err(`note: ${String(shortfall)} decoy place(s) could not be filled (no false perturbation found)\n`);
  const bySource = (s: string): number => draw.items.filter((i) => i.source === s).length;
  io.out(`union: ${String(draw.items.length)} items (${String(draw.negatives)} negatives; manifest-only ${String(bySource('manifest-only'))}, tool-only ${String(bySource('tool-only'))}, both ${String(bySource('both'))}, decoy ${String(bySource('decoy'))}) from ${String(all.length)} candidates over ${String(new Set(all.map((i) => i.projectId)).size)} cases -> ${sheetOut}; key -> ${need(args, 'key-out')}\n`);
  return 0;
}

export function unionAgreementMain(args: ReadonlyMap<string, string>, io: UnionIo): number {
  const key = readJson<{ rows: UnionKeyRow[] }>(need(args, 'key')).rows;
  const labels = new Map<string, Map<string, string>>();
  for (const spec of need(args, 'raters').split(',').filter((s) => s !== '')) {
    const eq = spec.indexOf('=');
    if (eq <= 0) throw new Error(`--raters takes name=file pairs, got ${spec}`);
    const name = spec.slice(0, eq);
    const file = spec.slice(eq + 1);
    if (labels.has(name)) throw new Error(`rater ${name} given twice`);
    const rows = parseUnionAnswers(fs.readFileSync(file, 'utf8'), file.endsWith('.csv'));
    labels.set(name, new Map(rows.map((r) => [r.itemId, r.answer])));
  }
  const model = args.get('model');
  if (model !== undefined) {
    const eq = model.indexOf('=');
    if (eq <= 0) throw new Error('--model takes name=labels.json[+labels2.json]');
    const byKey = new Map<string, string>();
    for (const f of model.slice(eq + 1).split('+')) for (const l of readJson<{ labels: MeaningfulItemLabel[] }>(f).labels) byKey.set(l.key, l.label);
    const name = model.slice(0, eq);
    if (labels.has(name)) throw new Error(`rater ${name} given twice`);
    labels.set(name, new Map(key.flatMap((k) => (byKey.has(k.key) ? [[k.itemId, byKey.get(k.key) ?? '']] : []))));
  }
  const report = unionAgreement(key, labels);
  writeJson(need(args, 'out'), report);
  const md = renderUnionAgreement(report);
  if (args.has('md-out')) writeFile(need(args, 'md-out'), md);
  for (const p of report.pairs) io.out(`${p.a} – ${p.b}: n ${String(p.binary.n)}, kappa(binary) ${p.binary.kappa?.toFixed(3) ?? 'n/a'}, AC1(binary) ${p.binary.ac1?.toFixed(3) ?? 'n/a'}, gate ${p.gate.pass ? 'pass' : 'below'}\n`);
  for (const s of report.summaries) io.out(`${s.rater}: decoy false-accept ${String(s.decoyFalseAccept.k)}/${String(s.decoyFalseAccept.n)}, tool findings yes ${String(s.toolYes.k)}/${String(s.toolYes.n)}\n`);
  return 0;
}
