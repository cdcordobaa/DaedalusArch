/**
 * SO5 failure-pattern taxonomy, step 1: episode cards (design: ops/notes/so5-taxonomy-design.md, sections 2 to 5).
 *
 * Zero model calls. Reads committed records under results/ only, writes
 *   experiments/so5-taxonomy/cards.json
 *   experiments/so5-taxonomy/README.md
 * Deterministic: the stratified caps use mulberry32 with seed 20261029. Run: npx tsx experiments/so5-taxonomy/build-cards.ts
 *
 * Never read: the MEAN-01 sample, daedalus-sealed, any sealed hold-out or calibration case set, v1.5 final-study lanes.
 * Cards carry no task names (neutral ids only), no agent chat text, no spend fields, no absolute paths.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..', '..');
const R = (...p: string[]): string => path.join(ROOT, 'results', ...p);
const SEED = 20261029;
const CAP = 60;
const MODEL_V15 = 'claude-sonnet-5-5';

// ---------- helpers ----------
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));
const readText = (p: string): string => fs.readFileSync(p, 'utf8');
const exists = (p: string): boolean => fs.existsSync(p);
const rel = (p: string): string => path.relative(ROOT, p).split(path.sep).join('/');
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// ---------- diff parsing ----------
interface Hunk { header: string; newStart: number; newCount: number; lines: string[] }
interface FileDiff { file: string; hunks: Hunk[] }
function parseDiff(text: string): Map<string, FileDiff> {
  const out = new Map<string, FileDiff>();
  let cur: FileDiff | null = null;
  let hunk: Hunk | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = /^diff --git a\/.+? b\/(.+)$/.exec(line);
      cur = m ? { file: m[1].replace(/^(?:b\/+)+/, '').replace(/^\/+/, '').replace(/^step-\d+\/+/, ''), hunks: [] } : null;
      if (cur) out.set(cur.file, cur);
      hunk = null;
    } else if (cur && line.startsWith('@@')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
      hunk = { header: line, newStart: m ? +m[1] : 1, newCount: m && m[2] !== undefined ? +m[2] : 1, lines: [] };
      cur.hunks.push(hunk);
    } else if (hunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '\\ No newline at end of file')) {
      if (!line.startsWith('+++') && !line.startsWith('---')) hunk.lines.push(line);
      else hunk.lines.push(line);
    }
  }
  return out;
}
const diffCache = new Map<string, Map<string, FileDiff>>();
function loadDiff(p: string): Map<string, FileDiff> | null {
  if (!exists(p)) return null;
  if (!diffCache.has(p)) diffCache.set(p, parseDiff(readText(p)));
  return diffCache.get(p)!;
}

interface HunkOut { file: string; header: string; lines: string[]; truncated: boolean; diffRef: string; anchorNewLine: number | null }
const STOP = new Set(['takes', 'several', 'aggregate', 'roots', 'vendor', 'symbol', 'code', 'writes', 'member', 'this', 'that', 'from', 'with', 'into', 'import']);
function tokensOf(s: string): string[] {
  const m = s.match(/[A-Za-z_][A-Za-z0-9_]{3,}/g) ?? [];
  return [...new Set(m.filter(t => !STOP.has(t.toLowerCase())))];
}
/** Pick a hunk of `fd` by line number or by identifier tokens; window to at most 40 lines (header included). */
function pickHunk(fd: FileDiff, diffRef: string, opt: { line?: number; tokens?: string[] }): HunkOut | null {
  let best: { h: Hunk; anchor: number; score: number } | null = null;
  for (const h of fd.hunks) {
    let nl = h.newStart;
    let score = 0;
    let anchor = -1;
    let anchorScore = 0;
    for (const l of h.lines) {
      const added = l.startsWith('+');
      const ctxOrAdd = added || l.startsWith(' ');
      if (added && opt.tokens) {
        const s = opt.tokens.filter(t => l.includes(t)).length;
        score += s;
        if (s > anchorScore) { anchorScore = s; anchor = nl; }
      }
      if (ctxOrAdd) {
        if (opt.line !== undefined && nl === opt.line && best === null) { score += 1000; anchor = nl; }
        nl++;
      }
    }
    if (!h.lines.some(l => l.startsWith('+'))) score -= 0.5;
    if (anchor < 0) anchor = h.newStart;
    if (!best || score > best.score) best = { h, anchor, score };
  }
  if (!best) return null;
  const body = best.h.lines;
  const maxBody = 39;
  let lines = body;
  let truncated = false;
  if (body.length > maxBody) {
    truncated = true;
    // find index of the anchor line within body and window around it
    let nl = best.h.newStart;
    let idx = 0;
    for (let i = 0; i < body.length; i++) {
      if (!body[i].startsWith('-')) { if (nl === best.anchor) { idx = i; break; } nl++; }
    }
    const start = Math.max(0, Math.min(body.length - maxBody, idx - 10));
    lines = body.slice(start, start + maxBody);
  }
  return { file: fd.file, header: best.h.header, lines, truncated, diffRef, anchorNewLine: best.anchor };
}

// ---------- enclosing type ----------
interface EnclosingType { name: string; kind: string; derivedFrom: string }
const DECL = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(class|interface|enum|type)\s+([A-Za-z_]\w*)/;
function enclosingFromText(text: string, line: number): EnclosingType | null {
  const ls = text.split('\n');
  for (let i = Math.min(line, ls.length) - 1; i >= 0; i--) {
    const m = DECL.exec(ls[i]);
    if (m) return { name: m[2], kind: m[1], derivedFrom: 'tree' };
  }
  return null;
}
function enclosingFromHunk(h: HunkOut | null, file: string): EnclosingType | null {
  if (h) {
    const ctx = /@@(.*)$/.exec(h.header)?.[1]?.trim();
    const mm = ctx ? DECL.exec(ctx) : null;
    if (mm) return { name: mm[2], kind: mm[1], derivedFrom: 'hunk-header' };
    for (const l of h.lines) {
      const m = DECL.exec(l.slice(1));
      if (m) return { name: m[2], kind: m[1], derivedFrom: 'hunk-text' };
    }
  }
  const base = path.basename(file).replace(/\.[tj]sx?$/, '');
  return base ? { name: base, kind: 'file', derivedFrom: 'filename' } : null;
}
function enclosing(h: HunkOut | null, file: string, snapRoot: string | null): EnclosingType | null {
  if (h && snapRoot) {
    const p = path.join(snapRoot, h.file);
    if (exists(p) && h.anchorNewLine !== null) {
      const e = enclosingFromText(readText(p), h.anchorNewLine);
      if (e) return e;
    }
  }
  return enclosingFromHunk(h, file);
}

// ---------- card model ----------
interface Draft {
  source: string;
  facets: { model: string; specLevel: string | null; style: string; arm: string; cell: string | null; step: number | string; session: string; task: string };
  file: string | null;
  hunk: HunkOut | null;
  hunkNote: string | null;
  enclosingType: EnclosingType | null;
  evidence: Record<string, unknown>;
  kind: 'failure' | 'repair';
  multiplicity: number;
  sortKey: string;
}
const SOURCE_ORDER = ['study1', 'study2b', 'hexddd01', 'puzzle01', 'puzzle02', 'puzzle03', 'puzzle04', 'traprate01'];
interface Tally { source: string; stratum: string; episodes: number; drawn: number }
const tallies: Tally[] = [];
const excluded: { source: string; what: string; count: number }[] = [];
const notes: string[] = [];

function stratifiedDraw(pool: Draft[], strata: (d: Draft) => string, cap: number, source: string): Draft[] {
  const groups = new Map<string, Draft[]>();
  for (const d of pool) {
    const k = strata(d);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  const keys = [...groups.keys()].sort(cmp);
  for (const k of keys) {
    const g = groups.get(k)!;
    g.sort((a, b) => cmp(a.sortKey, b.sortKey));
    for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
  }
  const quota = new Map<string, number>();
  let remaining = cap;
  let active = keys.slice();
  while (active.length && remaining > 0) {
    const q = Math.floor(remaining / active.length);
    const small = active.filter(k => groups.get(k)!.length <= (q || 0) && !quota.has(k));
    if (small.length) {
      for (const k of small) { quota.set(k, groups.get(k)!.length); remaining -= groups.get(k)!.length; }
      active = active.filter(k => !quota.has(k));
      continue;
    }
    // everyone left has more than q available: give q each, remainder one each in seeded order
    const order = active.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let extra = remaining - q * active.length;
    for (const k of order) {
      const add = q + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      quota.set(k, Math.min(add, groups.get(k)!.length));
    }
    remaining = 0;
    active = [];
  }
  const drawn: Draft[] = [];
  for (const k of keys) {
    const g = groups.get(k)!;
    const n = quota.get(k) ?? 0;
    drawn.push(...g.slice(0, n));
    tallies.push({ source, stratum: k, episodes: g.length, drawn: n });
  }
  return drawn;
}
function takeAll(pool: Draft[], strata: (d: Draft) => string, source: string): Draft[] {
  const counts = new Map<string, number>();
  for (const d of pool) counts.set(strata(d), (counts.get(strata(d)) ?? 0) + 1);
  for (const k of [...counts.keys()].sort(cmp)) tallies.push({ source, stratum: k, episodes: counts.get(k)!, drawn: counts.get(k)! });
  return pool;
}

// =====================================================================================================
// Study 1 (greenfield; generated trees are not committed, so evidence only)
// =====================================================================================================
function buildStudy1(): Draft[] {
  const cells = parseCsv(readText(R('v1.3-study1-rerun', 'e1', 'cells.csv')));
  const head = cells[0];
  const col = (n: string): number => head.indexOf(n);
  const taskNames = new Map<string, string>();
  const pool: Draft[] = [];
  let excludedCv05 = 0;
  let acceptedCells = 0;
  for (const row of cells.slice(1)) {
    if (!row[0] || row[col('study1_status')] !== 'accepted') continue;
    acceptedCells++;
    const runId = row[col('run_id')];
    const model = row[col('model')];
    const level = row[col('spec_level')];
    const task = row[col('task_id')];
    if (!taskNames.has(task)) taskNames.set(task, '');
    const runJson = readJson(R('e1-grid', 'runs', `${runId}.run.json`));
    const style = runJson.cell?.style ?? 'unknown';
    const report = readJson(R('v1.3-study1-rerun', 'e1', 'reports', `${runId}.json`));
    const tier = new Map<string, string>();
    for (const grp of ['blocking', 'advisory']) for (const r of report.tiers?.[grp]?.rules ?? []) tier.set(r.functionId, r.tier);
    const byFile = new Map<string, any[]>();
    for (const v of report.violations as any[]) {
      if (v.functionId === 'FF-CV05') { excludedCv05++; continue; }
      const f = v.filePath ?? '(project)';
      if (!byFile.has(f)) byFile.set(f, []);
      byFile.get(f)!.push(v);
    }
    for (const [file, vs] of byFile) {
      const rules = [...new Set(vs.map(v => v.functionId as string))].sort(cmp);
      pool.push({
        source: 'study1',
        facets: { model, specLevel: level, style, arm: 'none', cell: `${model}/${level}`, step: 'final', session: runId.replace(/^e1-grid-/, 'e1-'), task },
        file,
        hunk: null,
        hunkNote: 'greenfield generation; generated trees are not in the committed records, so no hunk',
        enclosingType: enclosingFromHunk(null, file),
        evidence: {
          ruleIds: rules,
          tiers: Object.fromEntries(rules.map(r => [r, tier.get(r) ?? 'unknown'])),
          violationTypes: [...new Set(vs.map(v => v.type as string))].sort(cmp),
          detail: [...new Set(vs.flatMap(v => (v.evidence ?? []) as string[]))].sort(cmp).slice(0, 8),
        },
        kind: 'failure',
        multiplicity: vs.length,
        sortKey: `${runId}|${file}`,
      });
    }
  }
  // neutral task ids
  const tasks = [...taskNames.keys()].sort(cmp);
  for (const d of pool) d.facets.task = `S1-T${tasks.indexOf(d.facets.task) + 1}`;
  notes.push(`Study 1: ${acceptedCells} accepted cells; ${excludedCv05} FF-CV05 test-pairing findings (noise per the HEXDDD-01 comparison and the design note) excluded before grouping.`);
  return pool;
}

// =====================================================================================================
// Study 2b (identity sets per step from score/rescore; the step snapshots live in tarballs that are not committed)
// =====================================================================================================
function buildStudy2b(): Draft[] {
  const dir = R('v1.4-study2b', 'score', 'rescore');
  const S: any[] = readJson(path.join(dir, 'snapshots.json'));
  const Rn: any[] = readJson(path.join(dir, 'runs.json'));
  const by = new Map<string, any[]>();
  for (const s of S) {
    const k = `${s.cell}|${s.runId}|${s.task}|${s.rep}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(s);
  }
  const taskNames = [...new Set(Rn.map(r => r.task as string))].sort(cmp);
  const pool: Draft[] = [];
  let recon = 0;
  for (const r of Rn) {
    const k = `${r.cell}|${r.runId}|${r.task}|${r.rep}`;
    const ss = (by.get(k) ?? []).sort((a, b) => a.step - b.step);
    const [arm, level] = (r.cell as string).split('@');
    const model = (r.runId as string).split('/')[1] ?? MODEL_V15;
    const session = `2b-${r.cell}-${r.rep}-T${taskNames.indexOf(r.task) + 1}`;
    const task = `S2-T${taskNames.indexOf(r.task) + 1}`;
    const kindOf = (fs_: any[], edge: string) => fs_.find(f => `${f.ruleId}|${f.file}|${f.target}` === edge);
    const seen = new Set<string>(ss[0].recorded.edges);
    const inherited = new Set<string>(ss[0].recorded.edges);
    const repaired = new Set<string>();
    const newByStepFile = new Map<string, { step: number; file: string; edges: string[]; kinds: Set<string>; targets: Set<string> }>();
    const perStep: number[] = [];
    for (const s of ss.slice(1)) {
      let n = 0;
      const cur = new Set<string>(s.recorded.edges);
      for (const e of cur) {
        if (seen.has(e)) continue;
        seen.add(e);
        n++;
        const [rule, file, target] = e.split('|');
        const kk = `${s.step}|${file}`;
        if (!newByStepFile.has(kk)) newByStepFile.set(kk, { step: s.step, file, edges: [], kinds: new Set(), targets: new Set() });
        const g = newByStepFile.get(kk)!;
        g.edges.push(e);
        g.targets.add(target);
        const f = kindOf(s.freeze.findings, e);
        if (f?.edgeKind) g.kinds.add(f.edgeKind);
        (g as any).rules = ((g as any).rules ?? new Set<string>()).add(rule);
      }
      perStep.push(n);
      // repairs: inherited identity first absent at this step
      const gone = [...inherited].filter(e => !cur.has(e) && !repaired.has(e));
      const goneByFile = new Map<string, string[]>();
      for (const e of gone) { repaired.add(e); const file = e.split('|')[1]; if (!goneByFile.has(file)) goneByFile.set(file, []); goneByFile.get(file)!.push(e); }
      for (const [file, es] of goneByFile) {
        const kinds = new Set<string>();
        const targets = new Set<string>();
        const rules = new Set<string>();
        for (const e of es) {
          const [rule, , target] = e.split('|');
          rules.add(rule); targets.add(target);
          const f = kindOf(ss[0].freeze.findings, e);
          if (f?.edgeKind) kinds.add(f.edgeKind);
        }
        pool.push({
          source: 'study2b',
          facets: { model, specLevel: level, style: 'Layered', arm, cell: r.cell, step: s.step, session, task },
          file,
          hunk: null,
          hunkNote: 'step snapshots are in uncommitted archives; identity sets only',
          enclosingType: enclosingFromHunk(null, file),
          evidence: { ruleIds: [...rules].sort(cmp), edgeKinds: [...kinds].sort(cmp), targets: [...targets].sort(cmp), detail: ['inherited violation absent from this step on'] },
          kind: 'repair',
          multiplicity: es.length,
          sortKey: `${k}|${s.step}|${file}|repair`,
        });
      }
    }
    if (JSON.stringify(perStep) === JSON.stringify(r.registered.perStepNew)) recon++;
    for (const g of newByStepFile.values()) {
      pool.push({
        source: 'study2b',
        facets: { model, specLevel: level, style: 'Layered', arm, cell: r.cell, step: g.step, session, task },
        file: g.file,
        hunk: null,
        hunkNote: 'step snapshots are in uncommitted archives; identity sets only',
        enclosingType: enclosingFromHunk(null, g.file),
        evidence: { ruleIds: [...((g as any).rules as Set<string>)].sort(cmp), edgeKinds: [...g.kinds].sort(cmp), targets: [...g.targets].sort(cmp), detail: ['new violation identity first present at this step'] },
        kind: 'failure',
        multiplicity: g.edges.length,
        sortKey: `${k}|${g.step}|${g.file}|failure`,
      });
    }
  }
  notes.push(`Study 2b: edge identities (rule|file|target) per step reconcile with the registered per-step D for ${recon} of ${Rn.length} runs (the builder asserts all).`);
  if (recon !== Rn.length) throw new Error('Study 2b reconciliation failed');
  return pool;
}

// =====================================================================================================
// HEXDDD-01 (hand-read log; hunks from the committed step diffs)
// =====================================================================================================
function buildHexddd(): Draft[] {
  const base = R('v1.4-pilot-hexddd-01');
  const rows = parseCsv(readText(path.join(base, 'hand-read-log.csv'))).slice(1).filter(r => r.length > 3);
  const dirs: Record<string, { dir: string; style: string; id: string }> = {
    s1: { dir: 's1-hotel-bookings', style: 'Hexagonal', id: 'S1' },
    s2: { dir: 's2-orders-invoices', style: 'DDD', id: 'S2' },
  };
  const out: Draft[] = [];
  for (const r of rows) {
    const [run, step, fileLine, family, , notesCol] = r;
    const m = /^(.+?):(\d+)$/.exec(fileLine);
    const file = m ? m[1] : fileLine;
    const line = m ? +m[2] : undefined;
    const d = dirs[run];
    const stepNo = +step;
    const diffPath = path.join(base, 'diffs', d.dir, `step-${String(stepNo).padStart(2, '0')}.diff`);
    const diff = loadDiff(diffPath);
    const fd = diff?.get(file);
    const hunk = fd ? pickHunk(fd, rel(diffPath).replace(d.dir, d.id.toLowerCase()), { line }) : null;
    if (hunk) hunk.diffRef = rel(diffPath).replace(d.dir, d.id.toLowerCase() + '-<task-dir>');
    const isRepair = /^Not a violation: planted debt FIXED/.test(notesCol ?? '');
    out.push({
      source: 'hexddd01',
      facets: { model: MODEL_V15, specLevel: null, style: d.style, arm: 'none', cell: null, step: stepNo, session: `hexddd-${d.id}`, task: d.id },
      file,
      hunk,
      hunkNote: hunk ? null : 'no hunk for this file at this step in the committed diff',
      enclosingType: enclosing(hunk, file, null),
      evidence: { handReadFamily: family, handReadSite: fileLine, ruleIds: [], detail: [] },
      kind: isRepair ? 'repair' : 'failure',
      multiplicity: 1,
      sortKey: `${run}|${String(stepNo).padStart(2, '0')}|${file}`,
    });
  }
  return out;
}

// =====================================================================================================
// PUZZLE-01 to PUZZLE-04 (oracle sub-goals failed at the final step; adjudications from the committed hand reads)
// =====================================================================================================
const PUZZLE_STYLE: Record<string, string> = { P1: 'DDD', P2: 'DDD', P3: 'Hexagonal', P3r: 'Hexagonal', P4: 'Layered', P5: 'DDD', P6: 'Layered' };
const puzzleCode = (name: string): string => 'P' + /^p(\d+r?)/.exec(name)![1];

/** session|SG -> verdict, parsed from a hand-read table. */
function parseHandRead(file: string): Map<string, string> {
  const m = new Map<string, string>();
  const text = readText(file);
  const sec = text.split(/\n## 2\./)[0];
  for (const line of sec.split('\n')) {
    if (!/^\| \d+ \|/.test(line)) continue;
    const cells = line.split('|').map(s => s.trim());
    const sess = /^(c\d+)/.exec(cells[2])?.[1];
    const sg = /^(SG\d)/.exec(cells[3])?.[1];
    const verdict = /\*\*(trap|over-rejection|unclear)\*\*/.exec(line)?.[1];
    if (sess && sg && verdict) m.set(`${sess}|${sg}`, verdict);
  }
  return m;
}
/** PUZZLE-04: adjudication proposals as committed in oracle-verdicts-to-read.md (arm gate; the pull arm has no oracle failure). */
const P4_PROPOSED: Record<string, string> = {
  'gate|c04|SG1': 'legit-clean', 'gate|c08|SG1': 'legit-clean', 'gate|c11|SG1': 'legit-clean',
  'gate|c09|SG1': 'legit-clean', 'gate|c09|SG2': 'legit-clean', 'gate|c16|SG1': 'legit-clean', 'gate|c16|SG2': 'legit-clean',
  'gate|c18|SG1': 'legit-clean',
  'gate|c22|SG1': 'trap', 'gate|c23|SG1': 'trap', 'gate|c07|SG2': 'trap',
};

function buildPuzzle(opts: { source: string; dir: string; arm: string; scoresPath: string; verdicts: (sess: string, sg: string) => string | undefined }): Draft[] {
  const scores = readJson(opts.scoresPath);
  const out: Draft[] = [];
  let over = 0;
  let unadjudicated = 0;
  let incomplete = 0;
  for (const s of scores.sessions as any[]) {
    const steps = s.steps as any[];
    const final = steps[steps.length - 1];
    if (s.complete === false) { incomplete += (final.oracle ?? []).filter((x: any) => !x.pass).length; continue; }
    const code = puzzleCode(s.puzzle);
    const sessionDir = path.join(opts.dir, 'sessions', s.session);
    for (const og of (final.oracle ?? []) as any[]) {
      if (og.pass) continue;
      const verdict = opts.verdicts(s.session, og.id);
      if (verdict === undefined) { unadjudicated++; continue; }
      if (verdict !== 'trap' && verdict !== 'unclear') { over++; continue; }
      // introducing step: start of the trailing run of failures
      let intro = steps.length - 1;
      while (intro > 0 && (steps[intro - 1].oracle ?? []).find((x: any) => x.id === og.id)?.pass === false) intro--;
      const introStep = steps[intro];
      const ev: string[] = (introStep.oracle.find((x: any) => x.id === og.id)?.evidence ?? []) as string[];
      const parsed: { file: string; line: number; text: string }[] = [];
      for (const e of ev) {
        const ms = [...e.matchAll(/([\w./-]+\.[tj]sx?):(\d+)/g)];
        for (const mm of ms) parsed.push({ file: mm[1], line: +mm[2], text: e });
      }
      const stepNo = +/step-(\d+)/.exec(introStep.step)![1];
      const stepsToTry: number[] = [];
      for (let n = stepNo; n <= +/step-(\d+)/.exec(final.step)![1]; n++) stepsToTry.push(n);
      let hunk: HunkOut | null = null;
      let hunkStep = stepNo;
      let file = parsed[0]?.file ?? null;
      const order = [...parsed].sort((a, b) => (/\/(ports|domain)\//.test(a.file) ? 1 : 0) - (/\/(ports|domain)\//.test(b.file) ? 1 : 0)).concat(parsed);
      outer: for (const n of stepsToTry) {
        const diffPath = path.join(opts.dir, 'diffs', s.session, `step-${String(n).padStart(2, '0')}.diff`);
        const diff = loadDiff(diffPath);
        for (const p of order) {
          const fd = diff?.get(p.file);
          if (!fd) continue;
          const h = pickHunk(fd, rel(diffPath), { tokens: tokensOf(p.text), line: n === stepNo ? p.line : undefined });
          if (h && h.lines.some(l => l.startsWith('+'))) { hunk = h; file = p.file; hunkStep = n; break outer; }
        }
      }
      const snapRoot = path.join(sessionDir, 'snap', `step-${String(hunkStep).padStart(2, '0')}`);
      out.push({
        source: opts.source,
        facets: { model: MODEL_V15, specLevel: null, style: PUZZLE_STYLE[code], arm: opts.arm, cell: null, step: stepNo, session: `${opts.source}-${opts.arm}-${s.session}`, task: code },
        file,
        hunk,
        hunkNote: hunk ? (hunkStep !== stepNo ? `cited file first changed in a later step diff (step ${hunkStep}) than the step the sub-goal started failing (${stepNo})` : null) : 'cited files (if any) are in no step diff from the introducing step on',
        enclosingType: enclosing(hunk, file ?? '', snapRoot),
        evidence: { oracleSubGoal: og.id, oracleFamily: introStep.oracle.find((x: any) => x.id === og.id)?.family ?? null, ruleIds: [], detail: ev, finalStepFailing: true },
        kind: 'failure',
        multiplicity: Math.max(1, parsed.length),
        sortKey: `${s.session}|${og.id}`,
      });
    }
  }
  if (over) excluded.push({ source: opts.source + '/' + opts.arm, what: 'oracle FAIL adjudicated over-rejection or legit-clean in the committed hand read (not a violated rule)', count: over });
  if (incomplete) excluded.push({ source: opts.source + '/' + opts.arm, what: 'oracle FAIL in an incomplete session (infrastructure failure, superseded by its redraw session)', count: incomplete });
  if (unadjudicated) excluded.push({ source: opts.source + '/' + opts.arm, what: 'oracle FAIL with no committed adjudication row', count: unadjudicated });
  return out;
}

// =====================================================================================================
// TRAPRATE-01
// =====================================================================================================
function buildTraprate(): Draft[] {
  const base = R('v1.5-traprate-01');
  const sc = readJson(path.join(base, 'scores', 'sessions.json'));
  const out: Draft[] = [];
  let selfRepaired = 0;
  let noOracle = 0;
  const label = (s: any) => ({ model: MODEL_V15, specLevel: null as string | null, style: s.style === 'ddd' ? 'DDD' : s.style === 'hexagonal' ? 'Hexagonal' : s.style, arm: 'none', cell: null as string | null });
  for (const s of sc.sessions as any[]) {
    const steps = (s.steps as any[]).filter(x => x.step !== 'step-00');
    const seenA = new Set<string>();
    const seenE = new Set<string>();
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      const stepNo = +/step-(\d+)/.exec(st.step)![1];
      const diffPath = path.join(base, 'diffs', s.session, `step-${String(stepNo).padStart(2, '0')}.diff`);
      const diff = loadDiff(diffPath);
      const snapRoot = path.join(base, 'sessions', s.session, 'snap', st.step);
      for (const [cls, ids, seen] of [['admitted', st.admittedNewVsSeed as string[], seenA], ['exploratory', st.exploratoryNewVsSeed as string[], seenE]] as [string, string[], Set<string>][]) {
        const fresh = ids.filter(id => !seen.has(id));
        for (const id of ids) seen.add(id);
        const byFile = new Map<string, { rules: Set<string>; subjects: Set<string>; n: number }>();
        for (const id of fresh) {
          const [rule, file, subject] = id.split('|');
          if (!byFile.has(file)) byFile.set(file, { rules: new Set(), subjects: new Set(), n: 0 });
          const g = byFile.get(file)!;
          g.rules.add(rule); g.subjects.add(subject); g.n++;
        }
        for (const [file, g] of [...byFile].sort((a, b) => cmp(a[0], b[0]))) {
          const subjects = [...g.subjects].sort(cmp);
          const toks = subjects.flatMap(x => x.split(/[.{}]+/)).filter(t => t.length > 2);
          const fd = diff?.get(file);
          const hunk = fd ? pickHunk(fd, rel(diffPath), { tokens: toks }) : null;
          let enc: EnclosingType | null = null;
          const cm = /^([A-Z]\w*)\./.exec(subjects[0] ?? '');
          if (cm) enc = { name: cm[1], kind: 'class', derivedFrom: 'identity-subject' };
          else enc = enclosing(hunk, file, snapRoot);
          out.push({
            source: 'traprate01',
            facets: { ...label(s), step: stepNo, session: `tr-${s.session}`, task: s.taskId },
            file,
            hunk,
            hunkNote: hunk ? null : 'file not in this step diff',
            enclosingType: enc,
            evidence: { ruleIds: [...g.rules].sort(cmp), ruleClass: cls, subjects, detail: ['new violation identity first present at this step'] },
            kind: 'failure',
            multiplicity: g.n,
            sortKey: `${s.session}|${String(stepNo).padStart(2, '0')}|${cls}|${file}`,
          });
        }
      }
      // identities that appear and vanish within the session (not carded; counted)
      if (i > 0) {
        const prev = new Set<string>(steps[i - 1].admittedNewVsSeed);
        const cur = new Set<string>(st.admittedNewVsSeed);
        for (const id of prev) if (!cur.has(id)) selfRepaired++;
      }
    }
    // trap sub-goals failed at the final step
    const final = steps[steps.length - 1];
    if (!final.oracle) noOracle++;
    for (const og of (final.oracle ?? []) as any[]) {
      if (og.pass) continue;
      let intro = steps.length - 1;
      while (intro > 0 && (steps[intro - 1].oracle ?? []).find((x: any) => x.id === og.id)?.pass === false) intro--;
      const stepNo = +/step-(\d+)/.exec(steps[intro].step)![1];
      const diffRef = rel(path.join(base, 'diffs', s.session, `step-${String(stepNo).padStart(2, '0')}.diff`));
      out.push({
        source: 'traprate01',
        facets: { ...label(s), step: stepNo, session: `tr-${s.session}`, task: s.taskId },
        file: null,
        hunk: null,
        hunkNote: `oracle sub-goal records carry no location; the introducing step diff is ${diffRef}`,
        enclosingType: null,
        evidence: { oracleSubGoal: og.id, ruleIds: [], detail: [], finalStepFailing: true, introducingStepDiff: diffRef },
        kind: 'failure',
        multiplicity: 1,
        sortKey: `${s.session}|99|${og.id}`,
      });
    }
  }
  notes.push(`TRAPRATE-01: ${noOracle} session(s) have no oracle record at the final step (no sub-goal episodes possible for them).`);
  notes.push(`TRAPRATE-01: ${selfRepaired} admitted identities appeared in a step and were absent at the next step (self-repairs within a session); not carded because the seeds carry no violation and the design defines repairs as inherited violations removed.`);
  return out;
}

// =====================================================================================================
// main
// =====================================================================================================
const all: Draft[] = [];
const s1 = stratifiedDraw(buildStudy1(), d => `${d.facets.model} x ${d.facets.specLevel}`, CAP, 'study1');
all.push(...s1);
const s2 = stratifiedDraw(buildStudy2b(), d => `${d.facets.cell} x step ${d.facets.step}`, CAP, 'study2b');
all.push(...s2);
all.push(...takeAll(buildHexddd(), d => `${d.facets.task} ${d.kind}`, 'hexddd01'));
const p1 = parseHandRead(R('v1.4-puzzle-01-baseline', 'hand-read.md'));
all.push(...takeAll(buildPuzzle({ source: 'puzzle01', dir: R('v1.4-puzzle-01-baseline'), arm: 'none', scoresPath: R('v1.4-puzzle-01-baseline', 'scores.json'), verdicts: (s, g) => p1.get(`${s}|${g}`) }), d => `${d.facets.task} ${d.facets.arm}`, 'puzzle01'));
const p2 = parseHandRead(R('v1.4-puzzle-02-tool-arm', 'hand-read.md'));
all.push(...takeAll(buildPuzzle({ source: 'puzzle02', dir: R('v1.4-puzzle-02-tool-arm'), arm: 'mcp-detect', scoresPath: R('v1.4-puzzle-02-tool-arm', 'scores.json'), verdicts: (s, g) => p2.get(`${s}|${g}`) }), d => `${d.facets.task} ${d.facets.arm}`, 'puzzle02'));
const p3 = parseHandRead(R('v1.4-puzzle-03-baseline', 'hand-read.md'));
all.push(...takeAll(buildPuzzle({ source: 'puzzle03', dir: R('v1.4-puzzle-03-baseline'), arm: 'none', scoresPath: R('v1.4-puzzle-03-baseline', 'scores.json'), verdicts: (s, g) => p3.get(`${s}|${g}`) }), d => `${d.facets.task} ${d.facets.arm}`, 'puzzle03'));
for (const arm of ['gate', 'pull']) {
  all.push(...takeAll(buildPuzzle({ source: 'puzzle04', dir: R('v1.4-puzzle-04', arm), arm, scoresPath: R('v1.4-puzzle-04', arm, 'scores.json'), verdicts: (s, g) => P4_PROPOSED[`${arm}|${s}|${g}`] }), d => `${d.facets.task} ${d.facets.arm}`, 'puzzle04'));
}
all.push(...takeAll(buildTraprate(), d => `${d.facets.style} ${d.evidence.oracleSubGoal ? 'oracle sub-goal' : 'new identity'}`, 'traprate01'));

all.sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || cmp(a.sortKey, b.sortKey));
const cards = all.map((d, i) => {
  const { sortKey, ...rest } = d;
  return {
    id: 'E' + String(i + 1).padStart(3, '0'),
    source: rest.source,
    facets: rest.facets,
    file: rest.file,
    hunk: rest.hunk && { file: rest.hunk.file, header: rest.hunk.header, lines: rest.hunk.lines, truncated: rest.hunk.truncated, diffRef: rest.hunk.diffRef },
    hunkNote: rest.hunkNote,
    enclosingType: rest.enclosingType,
    evidence: rest.evidence,
    kind: rest.kind,
    multiplicity: rest.multiplicity,
  };
});
for (const c of cards) if (c.hunk && c.hunk.lines.length + 1 > 40) throw new Error('hunk over 40 lines ' + c.id);

const meta = {
  schema: 'so5-cards/v1',
  design: 'ops/notes/so5-taxonomy-design.md',
  seed: SEED,
  cap: CAP,
  modelCalls: 0,
  cards: cards.length,
};
fs.writeFileSync(path.join(__dirname, 'cards.json'), JSON.stringify({ meta, cards }, null, 1) + '\n');

// ---------- README ----------
const count = (pred: (c: (typeof cards)[number]) => boolean): number => cards.filter(pred).length;
const rows: string[] = [];
for (const s of SOURCE_ORDER) {
  const n = count(c => c.source === s);
  const f = count(c => c.source === s && c.kind === 'failure');
  const rp = count(c => c.source === s && c.kind === 'repair');
  const h = count(c => c.source === s && c.hunk !== null);
  const tot = tallies.filter(t => t.source === s).reduce((a, t) => a + t.episodes, 0);
  rows.push(`| ${s} | ${tot} | ${n} | ${tot - n} | ${f} | ${rp} | ${h} |`);
}
const strat = (s: string): string => ['| Stratum | Episodes | Drawn | Not drawn |', '|---|---|---|---|', ...tallies.filter(t => t.source === s).map(t => `| ${t.stratum} | ${t.episodes} | ${t.drawn} | ${t.episodes - t.drawn} |`)].join('\n');
const readme = `# SO5 episode cards (step 1 of the failure-pattern taxonomy)

Built by \`build-cards.ts\` (zero model calls, deterministic; mulberry32 seed ${SEED}, cap ${CAP} episodes per capped source).
Design: \`ops/notes/so5-taxonomy-design.md\` sections 2 to 5. Output: \`cards.json\` (${cards.length} cards). Run: \`npx tsx experiments/so5-taxonomy/build-cards.ts\`.

The cards are **not coded or categorised**. Fields per card: \`id\` (E001..), \`source\`, \`facets\` (model, specLevel, style, arm,
cell, step, neutral session and task ids), \`file\`, \`hunk\` (at most 40 lines including the header; \`diffRef\` points to the committed diff),
\`enclosingType\` (from the committed tree where one exists, else the identity subject, hunk text or the file name; \`derivedFrom\` says which),
\`evidence\` (rule ids, or oracle sub-goal, or hand-read family; no interpretation), \`kind\` (failure or repair), \`multiplicity\`.
Task names are replaced by neutral ids (S1-T*, S2-T*, S1/S2 for HEXDDD-01, P1..P6 for puzzles, t01.. for TRAPRATE-01). Hunks and file paths are
agent code and naturally contain domain words; agent chat text and spend fields are in no card. The final-study lanes, the MEAN-01 sample,
\`daedalus-sealed\` and every sealed or calibration set were not opened.

## Counts per source

| Source | Episodes found | Cards drawn | Not drawn | Failure | Repair | With a hunk |
|---|---|---|---|---|---|---|
${rows.join('\n')}
| **total** | ${tallies.reduce((a, t) => a + t.episodes, 0)} | ${cards.length} | ${tallies.reduce((a, t) => a + t.episodes - t.drawn, 0)} | ${count(c => c.kind === 'failure')} | ${count(c => c.kind === 'repair')} | ${count(c => c.hunk !== null)} |

"Not drawn" is the stratified cap for Study 1 and Study 2b (water-filling over the strata, seeded shuffle inside each stratum) and, for the other
sources, zero by design. Oracle failures adjudicated as not a violation are listed below instead (they are not episodes).

### Excluded before counting
${excluded.length ? excluded.map(e => `- ${e.source}: ${e.count} x ${e.what}`).join('\n') : '- none'}

### Builder notes
${notes.map(n => `- ${n}`).join('\n')}

## Strata (drawn and not drawn)

### Study 1 (model x spec level; cap ${CAP})
${strat('study1')}

### Study 2b (cell x step; cap ${CAP})
${strat('study2b')}

### Other sources (taken whole)
${['hexddd01', 'puzzle01', 'puzzle02', 'puzzle03', 'puzzle04', 'traprate01'].map(s => `**${s}**\n\n${strat(s)}`).join('\n\n')}

## Episode definitions as built

- **Study 1** (greenfield, v1.3 symbolic reports of the 65 accepted cells): one episode per run and file, all non-FF-CV05 findings of that file merged
  (multiplicity = number of findings, rule ids and their v1.3 tier in the evidence). The step is \`final\`.
- **Study 2b**: edge identities (rule, file, target) per step from \`score/rescore/snapshots.json\`; a failure episode is the new identities of one run,
  step and source file (multiplicity = edges); a repair episode is the inherited (step 1) identities of one file first absent at a step.
  Steps 2 to 5; the builder asserts the per-step new counts equal the registered ones for all 120 runs.
- **HEXDDD-01**: the ten rows of \`hand-read-log.csv\` (nine violations, one row recording the planted-debt fix as a repair). Evidence is the hand-read
  family code and the cited site only; the log's notes are not copied.
- **PUZZLE-01..04**: one episode per session and oracle sub-goal failing on the final step whose committed hand read (PUZZLE-04: the committed
  proposal) is trap or unclear; the step is the start of the trailing run of failures; the hunk is chosen in that step's diff from the cited files by
  identifier overlap with the oracle evidence text.
- **TRAPRATE-01**: per session, new admitted or exploratory identities first present at a step, grouped by step and file (rule class in the evidence),
  plus one episode per oracle sub-goal failing at the final step.

## Not reconstructable from committed records (evidence only)

- **Study 1**: no hunk. The greenfield trees are generated outside the repository and not committed (the reports point to an outcomes directory that is not
  in the records), and a greenfield build has no diff. All Study 1 cards are evidence only.
- **Study 2b**: no hunk. The step snapshots are in tarballs referenced by \`archive/\` manifests and \`pointers.json\`; the tarballs are not committed. Cards carry the rule,
  file, edge targets and edge kind from the committed score records.
- **TRAPRATE-01 oracle sub-goal episodes**: the oracle records carry only the sub-goal id and pass flag, no location; the card gives the introducing-step diff path.
- **Any card with \`hunk: null\`** lists the reason in \`hunkNote\` (for example the cited file is not in that step's diff). The TRAPRATE-01, PUZZLE and HEXDDD-01
  snapshots omit directories named \`out/\` (a \`.gitignore\` rule); those hunks come from the step diffs, which keep them, and the enclosing type then falls back to the diff text or file name.
- HEXDDD-01 \`diffRef\` paths show \`<task-dir>\` in place of the task directory name (s1-* and s2-* under \`diffs/\`).
- Enclosing types without a committed tree (HEXDDD-01, Study 1, Study 2b) fall back to the hunk text or the file name; \`derivedFrom\` marks it.

## Limits to carry into coding

- PUZZLE-04 adjudications are the coordinator's committed proposals, not the author's decisions; the sensitivity of the PUZZLE-04 cards to them is the 8 excluded gate-arm failures above (plus 3 trap proposals kept).
- PUZZLE sources are trap tasks, so frequencies reflect the traps offered (design section 6).
- Study 1 cards include advisory-tier coupling findings (for example instability), which are metric findings, not necessarily a construct; the tier is in the evidence.
`;
fs.writeFileSync(path.join(__dirname, 'README.md'), readme);
console.log(JSON.stringify({ cards: cards.length, bySource: Object.fromEntries(SOURCE_ORDER.map(s => [s, count(c => c.source === s)])), excluded }, null, 1));
