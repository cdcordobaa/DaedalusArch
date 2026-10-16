/**
 * v1.3 symbolic–neural complementarity matrix on every planted seed (backlog N2). DEVELOPMENT SET ONLY. No LLM call.
 *
 * Question: for each seeded unit of the judge catch rounds (round 1, round 2, DUP v2) and of CHECK-2, does the
 * symbolic arm see the seed at all, and does the judge fail it? Judge verdicts are read from the committed scores
 * and verdict files; nothing is judged here.
 *
 * Classification rule (fixed before any number was computed; `classifySeed`):
 *   symbolic findings = the report's violations whose functionId is not a neural function (FF-N*), with the tier the
 *     report's `tiers` table gives the function (blocking, advisory; anything else is `none` and does not count).
 *   new findings      = the seeded copy's symbolic findings minus the base's, as a multiset over the key
 *     functionId|filePath|target (a second occurrence of a key the base already has once is new).
 *   symbolic-visible  iff at least one new blocking or advisory finding lies on an edited or created file of the seed
 *     (filePath equal to one), or names one as its target (the seeded edge: target equal to the file path, with or
 *     without its .ts/.tsx/.js extension). Symbolic-blind otherwise. `visibleBlocking` is the same with blocking only.
 *   Twins are classified by the same rule (a "visible" twin is a symbolic alarm on a near-miss).
 *   Clean units: symbolic-pass iff the unmodified base has no blocking finding on any file of the unit (the unit's
 *     files are the `filePaths` the recorded judge report lists for it); `cleanAll` also requires no advisory one.
 * Symbolic run: `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3` on every base and copy that
 * can be re-materialised here. The E1-cell rows (round 2 operator stratum, DUP v2 e1 stratum) cannot: their bases
 * live in `../daedalus-e1-outcomes`, which this checkout does not have. For them the symbolic findings are read from
 * the committed round reports (Neo4j engine, same scoring), and every table keeps the two sources apart
 * (`symbolicSource`). On the re-materialised rows the same rule is also applied to the committed reports, as an
 * engine and drift check (interp vs recorded).
 * Judge columns: v1 `catch` (unit fail or construct-flag majority, the rounds' headline) and `unitFail` from the
 * round scores; v2.1 majority unit fail from `results/v1.3-judge-v2/{tune,check}-v2.1` (TUNE was tuned on: in-sample).
 * Pooling: seeds are de-duplicated by base and normalised committed diff (round 2's DUP-RULE seeds and the DUP v2
 * seeds can be the same edit); the first occurrence in round order r1, r2, dv2 is kept.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/complementarity.ts prepare --work <work> [--e1 <dir>]
 *     runs the frozen seed scripts unchanged: judge-catch-seed.ts → <work>/r1, judge-catch2-seed.ts → <work>/r2,
 *     judge-catch-v2-seed.ts → <work>/dv2. Without the E1 outcomes directory (default ../daedalus-e1-outcomes) the
 *     last two run from a shadow repository root (`<work>/shadow`: symlinks to the checkout, with an empty
 *     results/e1-grid/runs), so they produce only their non-E1 rows (hand-planted, fixture); those use no random
 *     stream after the E1 one, and `main` checks them field for field against the committed manifests.
 *   (optional, from a read-only checkout of v1.3-judge-v22-prep) judge-v22-check2.ts seed --out <work>/c2 --check
 *   npx tsx scripts/v1.3/complementarity.ts --work <work> [--check2-repo <v22 checkout>] [--out <dir>]
 * Writes `<out>/symbolic.json` (compact symbolic findings per evaluated project), `<out>/rows.csv`,
 * `<out>/scores.json` and `<out>/scores.md` (default out: results/v1.3-complementarity).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { wilson } from '../lib/stats.js';

export type Tier = 'blocking' | 'advisory' | 'none';

export interface SymFinding {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly tier: Tier;
  readonly line?: number;
}

interface ReportViolation {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly line?: number;
}

interface ReportLike {
  readonly violations?: readonly ReportViolation[];
  readonly tiers?: { readonly blocking?: { readonly rules?: readonly { functionId: string }[] }; readonly advisory?: { readonly rules?: readonly { functionId: string }[] }; readonly verdict?: string } | null;
  readonly neuralResults?: readonly { functionId: string; unitResults: readonly { unitId: string; filePaths?: readonly string[] }[] }[];
}

// ── The committed rule ───────────────────────────────────────────────────────────

export function findingKey(f: { functionId: string; filePath: string; target?: string }): string {
  return `${f.functionId}|${f.filePath}|${f.target ?? ''}`;
}

/** The symbolic findings of a report, with the tier of their function. */
export function symbolicFindings(rep: ReportLike): SymFinding[] {
  const blocking = new Set((rep.tiers?.blocking?.rules ?? []).map((r) => r.functionId));
  const advisory = new Set((rep.tiers?.advisory?.rules ?? []).map((r) => r.functionId));
  return (rep.violations ?? [])
    .filter((v) => !v.functionId.startsWith('FF-N'))
    .map((v) => ({
      functionId: v.functionId, filePath: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}),
      tier: blocking.has(v.functionId) ? 'blocking' : advisory.has(v.functionId) ? 'advisory' : 'none',
      ...(v.line !== undefined ? { line: v.line } : {}),
    }));
}

/** Multiset difference over `findingKey`: the seeded findings the base does not account for. */
export function newFindings(base: readonly SymFinding[], seeded: readonly SymFinding[]): SymFinding[] {
  const left = new Map<string, number>();
  for (const f of base) left.set(findingKey(f), (left.get(findingKey(f)) ?? 0) + 1);
  const out: SymFinding[] = [];
  for (const f of seeded) {
    const n = left.get(findingKey(f)) ?? 0;
    if (n > 0) left.set(findingKey(f), n - 1);
    else out.push(f);
  }
  return out;
}

const stripExt = (p: string): string => p.replace(/\.(tsx?|js)$/, '');

/** The finding lies on one of `files`, or names one as its target (with or without extension). */
export function touches(f: SymFinding, files: readonly string[]): boolean {
  if (files.includes(f.filePath)) return true;
  if (f.target === undefined) return false;
  const t = stripExt(f.target);
  return files.some((x) => stripExt(x) === t);
}

export interface SeedClass {
  readonly visible: boolean;
  readonly visibleBlocking: boolean;
  readonly hits: readonly SymFinding[];
}

export function classifySeed(base: readonly SymFinding[], seeded: readonly SymFinding[], files: readonly string[]): SeedClass {
  const hits = newFindings(base, seeded).filter((f) => f.tier !== 'none' && touches(f, files));
  return { visible: hits.length > 0, visibleBlocking: hits.some((f) => f.tier === 'blocking'), hits };
}

/** Clean unit: no blocking finding on any of its files (`all`: no blocking or advisory finding). */
export function cleanUnitPass(base: readonly SymFinding[], unitFiles: readonly string[]): { pass: boolean; passAll: boolean } {
  const on = base.filter((f) => unitFiles.includes(f.filePath));
  return { pass: !on.some((f) => f.tier === 'blocking'), passAll: !on.some((f) => f.tier !== 'none') };
}

/** Majority over the valid runs: true = fail. Null when no valid run. */
export function majorityFail(runs: readonly { valid: boolean; pass?: boolean }[]): boolean | null {
  const v = runs.filter((r) => r.valid && r.pass !== undefined);
  if (v.length === 0) return null;
  return v.filter((r) => r.pass === false).length * 2 > v.length;
}

/** Hunk lines of a unified diff (headers and timestamps dropped), for byte comparison and de-duplication. */
export function diffBody(diff: string): string {
  return diff.split('\n').filter((l) => !l.startsWith('diff ') && !l.startsWith('--- ') && !l.startsWith('+++ ') && !l.startsWith('Only in ')).join('\n').trim();
}

export interface Rate {
  readonly k: number;
  readonly n: number;
  readonly rate: number | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly text: string;
}

export function rate(k: number, n: number): Rate {
  if (n === 0) return { k, n, rate: null, low: null, high: null, text: '0/0' };
  const w = wilson(k, n);
  return { k, n, rate: k / n, low: w.low, high: w.high, text: `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]` };
}

// ── Inputs ──────────────────────────────────────────────────────────────────────

type Round = 'r1' | 'r2' | 'dv2' | 'c2';

interface ManifestRow {
  readonly rowId: string;
  readonly operatorId: string;
  readonly positiveId?: string;
  readonly family?: string;
  readonly role: 'seed' | 'twin';
  readonly baseId: string;
  readonly style: string;
  readonly specPath: string;
  readonly status: string;
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly copyDir?: string;
  readonly stratum?: string;
  readonly baseKind?: string;
  readonly twinOf?: string;
  readonly probedFunction?: string;
}

interface ScoreRow {
  readonly rowId: string;
  readonly role: 'seed' | 'twin';
  readonly judged: boolean;
  readonly catch?: boolean;
  readonly unitFail?: boolean;
  readonly probedFunction?: string;
  readonly units?: readonly { unit: string }[];
}

interface CleanUnit {
  readonly base: string;
  readonly unit: string;
  readonly fn: string;
  readonly verdict: string | null;
  readonly stratum?: string;
}

const ROUND_DIRS: Readonly<Record<Exclude<Round, 'c2'>, string>> = {
  r1: 'results/v1.3-judge-catch',
  r2: 'results/v1.3-judge-catch/round2',
  dv2: 'results/v1.3-judge-catch/duprule-v2',
};

const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const safe = (id: string): string => id.replace(/\//g, '__');
const isE1 = (baseId: string): boolean => baseId.startsWith('e1/');

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

interface Project {
  readonly key: string;
  readonly dir: string;
  readonly spec: string;
}

function evaluateSymbolic(repoRoot: string, p: Project, cacheDir: string): ReportLike {
  const cache = path.join(cacheDir, `${safe(p.key)}.json`);
  if (fs.existsSync(cache)) return readJson<ReportLike>(cache);
  const r = spawnSync('npx', ['tsx', 'bin/firewall.ts', 'evaluate', '--project', p.dir, '--spec', p.spec, '--format', 'json', '--symbolic-only', '--engine', 'cypher-interp', '--scoring', 'v1.3'], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  // Exit 1 is a failing verdict; anything else without a report is an error.
  if (r.status !== 0 && r.status !== 1) throw new Error(`evaluate ${p.key} exited ${String(r.status)}: ${r.stderr.slice(-800)}`);
  const rep = JSON.parse(r.stdout) as ReportLike;
  fs.writeFileSync(cache, r.stdout);
  return rep;
}

/**
 * Byte check of a re-materialised copy: the committed diff, applied to the base with no fuzz (`patch -F0`, strip
 * level 1 or 2 as the diff's paths need), must give a tree identical to the copy (`diff -r`, node_modules excluded).
 * Hunk text itself is not compared: the committed diffs were written by another `diff` build, whose hunk layout differs.
 */
function copyMatchesDiff(baseDir: string, copyDir: string, diffPath: string, tmp: string): boolean {
  for (const strip of ['-p1', '-p2']) {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.cpSync(baseDir, tmp, { recursive: true, filter: (src) => path.basename(src) !== 'node_modules' });
    const p = spawnSync('patch', ['-s', '-F0', strip, '-d', tmp, '-i', diffPath], { encoding: 'utf8' });
    if (p.status !== 0) continue;
    const d = spawnSync('diff', ['-r', '-x', 'node_modules', '-x', '*.orig', tmp, copyDir], { encoding: 'utf8' });
    return d.status === 0;
  }
  return false;
}

// ── Main ────────────────────────────────────────────────────────────────────────

interface OutRow {
  round: Round;
  rowId: string;
  role: 'seed' | 'twin';
  family: string;
  operatorId: string;
  style: string;
  stratum: string;
  baseId: string;
  split: string;
  symbolicSource: 'interp' | 'recorded-neo4j';
  visible: boolean;
  visibleBlocking: boolean;
  hitRules: string;
  recordedVisible: boolean | null;
  judgeV1Catch: boolean | null;
  judgeV1UnitFail: boolean | null;
  judgeV21Fail: boolean | null;
  dedupKey: string;
  copyByteCheck: boolean | null;
}

interface OutClean {
  round: Round;
  baseId: string;
  fn: string;
  unit: string;
  split: string;
  symbolicSource: 'interp' | 'recorded-neo4j';
  files: number;
  symbolicPass: boolean;
  symbolicPassAll: boolean;
  judgeV1Fail: boolean | null;
  judgeV21Fail: boolean | null;
}

/** A repository root that sees the checkout but no E1 run (the seed scripts then skip their E1 stratum). */
function shadowRoot(repoRoot: string, dest: string): string {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, 'results/e1-grid/runs'), { recursive: true });
  for (const e of fs.readdirSync(repoRoot)) if (e !== 'results') fs.symlinkSync(path.join(repoRoot, e), path.join(dest, e));
  for (const e of fs.readdirSync(path.join(repoRoot, 'results'))) if (e !== 'e1-grid') fs.symlinkSync(path.join(repoRoot, 'results', e), path.join(dest, 'results', e));
  return dest;
}

function prepare(argv: readonly string[], repoRoot: string, work: string): number {
  const e1 = path.resolve(repoRoot, argOf(argv, '--e1') ?? '../daedalus-e1-outcomes');
  const haveE1 = fs.existsSync(e1);
  const root = haveE1 ? repoRoot : shadowRoot(repoRoot, path.join(work, 'shadow'));
  const runs: [string, string, string, readonly string[]][] = [
    ['r1', repoRoot, 'judge-catch-seed.ts', []],
    ['r2', root, 'judge-catch2-seed.ts', haveE1 ? ['--e1', e1] : []],
    ['dv2', root, 'judge-catch-v2-seed.ts', haveE1 ? ['--e1', e1] : []],
  ];
  for (const [round, cwd, script, extra] of runs) {
    const out = path.join(work, round);
    fs.rmSync(out, { recursive: true, force: true });
    const r = spawnSync('npx', ['tsx', path.join(cwd, 'scripts/v1.3', script), '--out', out, ...extra], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) {
      process.stderr.write(`${script} exited ${String(r.status)}: ${r.stderr.slice(-800)}\n`);
      return 1;
    }
    process.stderr.write(`${round}: ${script} done${haveE1 || round === 'r1' ? '' : ' (no E1 stratum)'}\n`);
  }
  return 0;
}

export function main(argv: readonly string[], repoRoot: string): number {
  const workArg = argOf(argv, '--work');
  if (workArg === undefined) {
    process.stderr.write('usage: complementarity.ts [prepare] --work <dir> [--e1 <dir>] [--check2-repo <dir>] [--out <dir>]\n');
    return 2;
  }
  const work = path.resolve(workArg);
  if (argv[0] === 'prepare') return prepare(argv, repoRoot, work);
  const out = path.resolve(repoRoot, argOf(argv, '--out') ?? 'results/v1.3-complementarity');
  const check2Repo = argOf(argv, '--check2-repo');
  const cacheDir = path.join(work, 'symbolic-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(out, { recursive: true });

  // Split and v2.1 verdicts.
  const split = readJson<{ items: { itemId: string; round: string; targetId: string; split: string }[] }>(path.join(repoRoot, 'results/v1.3-judge-v2/split.json'));
  const splitOfTarget = new Map<string, string>();
  const splitOfItem = new Map<string, string>();
  for (const it of split.items) {
    splitOfItem.set(it.itemId, it.split);
    const k = `${it.round}|${it.targetId}`;
    const prev = splitOfTarget.get(k);
    splitOfTarget.set(k, prev === undefined || prev === it.split ? it.split : 'mixed');
  }
  const v21 = new Map<string, boolean | null>();
  for (const ph of ['tune-v2.1', 'check-v2.1']) {
    const f = readJson<{ verdicts: { itemId: string; runs: { valid: boolean; pass?: boolean }[] }[] }>(path.join(repoRoot, 'results/v1.3-judge-v2', ph, 'verdicts.json'));
    for (const v of f.verdicts) v21.set(v.itemId, majorityFail(v.runs));
  }
  const v21Target = (round: string, targetId: string): boolean | null => {
    const vals = [...v21.entries()].filter(([k]) => k.startsWith(`${round}|${targetId}|`)).map(([, v]) => v);
    if (vals.length === 0 || vals.every((v) => v === null)) return null;
    return vals.some((v) => v === true);
  };

  const symbolicJson: Record<string, { source: string; verdict: string | null; findings: SymFinding[] }> = {};
  const recordSym = (key: string, source: string, rep: ReportLike): SymFinding[] => {
    const f = symbolicFindings(rep);
    symbolicJson[key] = { source, verdict: rep.tiers?.verdict ?? null, findings: f };
    return f;
  };
  const outRows: OutRow[] = [];
  const outClean: OutClean[] = [];
  const checks: string[] = [];

  for (const round of ['r1', 'r2', 'dv2'] as const) {
    const resDir = path.join(repoRoot, ROUND_DIRS[round]);
    const committed = readJson<{ rows: ManifestRow[] }>(path.join(resDir, 'seed-manifest.json')).rows;
    const regen = readJson<{ rows: ManifestRow[] }>(path.join(work, round, 'seed-manifest.json')).rows;
    const committedById = new Map(committed.map((r) => [r.rowId, r]));
    // The re-materialised rows must equal the committed ones, field for field; E1 rows are absent here by construction.
    let same = 0;
    for (const r of regen) {
      const c = committedById.get(r.rowId);
      if (c === undefined || JSON.stringify(c) !== JSON.stringify(r)) throw new Error(`${round}: regenerated row ${r.rowId} differs from the committed manifest`);
      same++;
    }
    const missingNonE1 = committed.filter((r) => !isE1(r.baseId) && !regen.some((x) => x.rowId === r.rowId));
    if (missingNonE1.length > 0) throw new Error(`${round}: rows not regenerated: ${missingNonE1.map((r) => r.rowId).join(', ')}`);
    checks.push(`${round}: ${String(same)} of ${String(committed.length)} manifest rows regenerated and identical; ${String(committed.length - same)} E1 rows not re-materialisable here`);

    const scores = readJson<{ rows: ScoreRow[]; cleanUnits: CleanUnit[] }>(path.join(resDir, 'scores.json'));
    const recorded = (id: string): ReportLike | null => {
      const p = path.join(resDir, 'reports', `${safe(id.replace(/^base:/, 'base__'))}.json`);
      return fs.existsSync(p) ? readJson<ReportLike>(p) : null;
    };
    const baseSpec = new Map<string, string>();
    for (const r of committed) if (!baseSpec.has(r.baseId)) baseSpec.set(r.baseId, r.specPath);
    const symOf = new Map<string, SymFinding[]>();
    const symFor = (id: string, dir: string | null, spec: string, e1: boolean): SymFinding[] => {
      const key = `${round}:${id}`;
      const hit = symOf.get(key);
      if (hit !== undefined) return hit;
      let f: SymFinding[];
      if (e1) {
        const rep = recorded(id);
        if (rep === null) throw new Error(`${round}: no recorded report for ${id}`);
        f = recordSym(key, 'recorded-neo4j', rep);
      } else {
        if (dir === null) throw new Error(`${round}: no directory for ${id}`);
        f = recordSym(key, 'interp', evaluateSymbolic(repoRoot, { key, dir, spec: path.resolve(repoRoot, spec) }, cacheDir));
      }
      symOf.set(key, f);
      return f;
    };
    const baseDir = (baseId: string): string => path.join(work, round, 'bases', safe(baseId));

    for (const s of scores.rows.filter((x) => x.judged)) {
      const m = committedById.get(s.rowId);
      if (m === undefined) throw new Error(`${round}: scored row ${s.rowId} not in the manifest`);
      const e1 = isE1(m.baseId);
      const files = [...new Set([...m.editedFiles, ...m.createdFiles])];
      const base = symFor(`base:${m.baseId}`, e1 ? null : baseDir(m.baseId), m.specPath, e1);
      const seeded = symFor(m.rowId, e1 ? null : path.join(work, round, m.copyDir ?? `copies/${m.rowId}`), m.specPath, e1);
      const cls = classifySeed(base, seeded, files);
      let recordedVisible: boolean | null = null;
      let copyByteCheck: boolean | null = null;
      const diffPath = path.join(resDir, 'diffs', `${m.rowId}.diff`);
      const diffText = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, 'utf8') : '';
      if (!e1) {
        const rb = recorded(`base:${m.baseId}`);
        const rs = recorded(m.rowId);
        if (rb !== null && rs !== null) recordedVisible = classifySeed(symbolicFindings(rb), symbolicFindings(rs), files).visible;
        if (diffText !== '') copyByteCheck = copyMatchesDiff(baseDir(m.baseId), path.join(work, round, m.copyDir ?? ''), diffPath, path.join(work, 'diffcheck'));
      }
      const family = (m.positiveId ?? m.operatorId).replace(/2$/, '');
      outRows.push({
        round, rowId: m.rowId, role: m.role, family, operatorId: m.operatorId, style: m.style,
        stratum: m.stratum ?? m.baseKind ?? '', baseId: m.baseId, split: splitOfTarget.get(`${round}|${m.rowId}`) ?? 'none',
        symbolicSource: e1 ? 'recorded-neo4j' : 'interp', visible: cls.visible, visibleBlocking: cls.visibleBlocking,
        hitRules: [...new Set(cls.hits.map((h) => `${h.functionId}:${h.tier}`))].join(';'), recordedVisible,
        judgeV1Catch: s.catch ?? null, judgeV1UnitFail: s.unitFail ?? null, judgeV21Fail: v21Target(round, m.rowId),
        dedupKey: createHash('sha256').update(`${m.baseId}\n${diffText === '' ? m.rowId : diffBody(diffText)}`).digest('hex').slice(0, 16),
        copyByteCheck,
      });
    }

    for (const c of scores.cleanUnits) {
      const e1 = isE1(c.base);
      const spec = baseSpec.get(c.base);
      if (spec === undefined) throw new Error(`${round}: no spec for base ${c.base}`);
      const base = symFor(`base:${c.base}`, e1 ? null : baseDir(c.base), spec, e1);
      const rb = recorded(`base:${c.base}`);
      const files = rb?.neuralResults?.find((n) => n.functionId === c.fn)?.unitResults.find((u) => u.unitId === c.unit)?.filePaths ?? [];
      if (files.length === 0) throw new Error(`${round}: no files for clean unit ${c.base} ${c.fn} ${c.unit}`);
      const p = cleanUnitPass(base, files);
      const itemId = `${round}|base:${c.base}|${c.fn}|${c.unit}`;
      outClean.push({
        round, baseId: c.base, fn: c.fn, unit: c.unit, split: splitOfItem.get(itemId) ?? 'none', symbolicSource: e1 ? 'recorded-neo4j' : 'interp',
        files: files.length, symbolicPass: p.pass, symbolicPassAll: p.passAll, judgeV1Fail: c.verdict === null ? null : c.verdict === 'fail',
        judgeV21Fail: v21.has(itemId) ? (v21.get(itemId) ?? null) : null,
      });
    }
  }

  // CHECK-2 (symbolic only; v2.2 has not been run, so its judge cells are pending).
  if (check2Repo !== undefined) {
    const c2Root = path.resolve(check2Repo);
    const m = readJson<{ rows: ManifestRow[] }>(path.join(work, 'c2', 'seed-manifest.json')).rows;
    const committedC2 = path.join(c2Root, 'results/v1.3-judge-v22/check2-seed-manifest.json');
    if (fs.readFileSync(path.join(work, 'c2', 'seed-manifest.json'), 'utf8') !== fs.readFileSync(committedC2, 'utf8')) throw new Error('c2: seed manifest differs from the committed one');
    checks.push(`c2: ${String(m.length)} manifest rows, byte-identical to v1.3-judge-v22-prep's committed manifest`);
    const symC2 = new Map<string, SymFinding[]>();
    const symFor = (id: string, dir: string, spec: string): SymFinding[] => {
      const key = `c2:${id}`;
      const hit = symC2.get(key);
      if (hit !== undefined) return hit;
      const f = recordSym(key, 'interp', evaluateSymbolic(repoRoot, { key, dir, spec: path.join(c2Root, spec) }, cacheDir));
      symC2.set(key, f);
      return f;
    };
    for (const r of m.filter((x) => x.status === 'ok')) {
      const base = symFor(`base:${r.baseId}`, path.join(work, 'c2', 'bases', r.baseId), r.specPath);
      const seeded = symFor(r.rowId, path.join(work, 'c2', r.copyDir ?? `copies/${r.rowId}`), r.specPath);
      const cls = classifySeed(base, seeded, [...new Set([...r.editedFiles, ...r.createdFiles])]);
      outRows.push({
        round: 'c2', rowId: r.rowId, role: r.role, family: r.family ?? r.operatorId, operatorId: r.operatorId, style: r.style, stratum: 'check2',
        baseId: r.baseId, split: 'CHECK-2', symbolicSource: 'interp', visible: cls.visible, visibleBlocking: cls.visibleBlocking,
        hitRules: [...new Set(cls.hits.map((h) => `${h.functionId}:${h.tier}`))].join(';'), recordedVisible: null,
        judgeV1Catch: null, judgeV1UnitFail: null, judgeV21Fail: null, dedupKey: r.rowId, copyByteCheck: null,
      });
    }
  }

  const scores = analyse(outRows, outClean, checks);
  const sortedSym = Object.fromEntries(Object.entries(symbolicJson).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(path.join(out, 'symbolic.json'), `${JSON.stringify(sortedSym, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'scores.json'), `${JSON.stringify(scores, null, 2)}\n`);
  const cols = Object.keys(outRows[0] ?? {}) as (keyof OutRow)[];
  const cell = (v: string | boolean | number | null): string => (v === null ? '' : String(v));
  fs.writeFileSync(path.join(out, 'rows.csv'), `${[cols.join(','), ...outRows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')}\n`);
  const ccols = Object.keys(outClean[0] ?? {}) as (keyof OutClean)[];
  fs.writeFileSync(path.join(out, 'clean-units.csv'), `${[ccols.join(','), ...outClean.map((r) => ccols.map((c) => cell(r[c])).join(','))].join('\n')}\n`);
  fs.writeFileSync(path.join(out, 'scores.md'), renderMd(scores));
  process.stdout.write(renderMd(scores));
  return 0;
}

// ── Analysis (fixed with the rule) ─────────────────────────────────────────────

interface Cell2 {
  readonly visibleCaught: number;
  readonly visibleMissed: number;
  readonly blindCaught: number;
  readonly blindMissed: number;
  readonly unjudged: number;
}

function twoByTwo(rows: readonly OutRow[], judge: (r: OutRow) => boolean | null): Cell2 {
  const j = rows.map((r) => ({ r, c: judge(r) }));
  return {
    visibleCaught: j.filter((x) => x.r.visible && x.c === true).length,
    visibleMissed: j.filter((x) => x.r.visible && x.c === false).length,
    blindCaught: j.filter((x) => !x.r.visible && x.c === true).length,
    blindMissed: j.filter((x) => !x.r.visible && x.c === false).length,
    unjudged: j.filter((x) => x.c === null).length,
  };
}

const catchGivenBlind = (c: Cell2): Rate => rate(c.blindCaught, c.blindCaught + c.blindMissed);
const catchGivenVisible = (c: Cell2): Rate => rate(c.visibleCaught, c.visibleCaught + c.visibleMissed);

function dedup(rows: readonly OutRow[]): OutRow[] {
  const seen = new Set<string>();
  const out: OutRow[] = [];
  for (const r of rows) {
    if (seen.has(r.dedupKey)) continue;
    seen.add(r.dedupKey);
    out.push(r);
  }
  return out;
}

export function analyse(rows: readonly OutRow[], clean: readonly OutClean[], checks: readonly string[]): Record<string, unknown> {
  const judgedRounds = rows.filter((r) => r.round !== 'c2');
  const seedsAll = judgedRounds.filter((r) => r.role === 'seed');
  const seeds = dedup(seedsAll);
  const twins = dedup(judgedRounds.filter((r) => r.role === 'twin'));
  const v1 = (r: OutRow): boolean | null => r.judgeV1Catch;
  const v1u = (r: OutRow): boolean | null => r.judgeV1UnitFail;
  const v21 = (r: OutRow): boolean | null => r.judgeV21Fail;
  const group = (xs: readonly OutRow[], key: (r: OutRow) => string): Record<string, Cell2 & { catchGivenBlind: string; catchGivenVisible: string }> => {
    const out: Record<string, Cell2 & { catchGivenBlind: string; catchGivenVisible: string }> = {};
    for (const k of [...new Set(xs.map(key))].sort()) {
      const c = twoByTwo(xs.filter((r) => key(r) === k), v1);
      out[k] = { ...c, catchGivenBlind: catchGivenBlind(c).text, catchGivenVisible: catchGivenVisible(c).text };
    }
    return out;
  };
  const pooled = twoByTwo(seeds, v1);
  const pooledInterp = twoByTwo(seeds.filter((r) => r.symbolicSource === 'interp'), v1);
  const pooledRecorded = twoByTwo(seeds.filter((r) => r.symbolicSource === 'recorded-neo4j'), v1);
  const twin2 = twoByTwo(twins, (r) => r.judgeV1UnitFail);
  const cleanJ = clean.filter((c) => c.judgeV1Fail !== null);
  const cleanPass = cleanJ.filter((c) => c.symbolicPass);
  const cleanPassAll = cleanJ.filter((c) => c.symbolicPassAll);
  const cleanV21 = clean.filter((c) => c.judgeV21Fail !== null && c.symbolicPass);
  const agree = seedsAll.concat(judgedRounds.filter((r) => r.role === 'twin')).filter((r) => r.recordedVisible !== null);
  const c2 = rows.filter((r) => r.round === 'c2');
  const c2Seeds = c2.filter((r) => r.role === 'seed');
  const c2Fam: Record<string, { seeds: number; visible: number; visibleBlocking: number; twins: number; twinsVisible: number }> = {};
  for (const f of [...new Set(c2.map((r) => r.family))].sort()) {
    const s = c2Seeds.filter((r) => r.family === f);
    const t = c2.filter((r) => r.family === f && r.role === 'twin');
    c2Fam[f] = { seeds: s.length, visible: s.filter((r) => r.visible).length, visibleBlocking: s.filter((r) => r.visibleBlocking).length, twins: t.length, twinsVisible: t.filter((r) => r.visible).length };
  }
  return {
    label: 'DEVELOPMENT-SET NUMBERS (construct sensitivity and complementarity); not validity estimates',
    checks,
    seeds: { all: seedsAll.length, deduplicated: seeds.length, duplicates: seedsAll.length - seeds.length },
    pooled: { ...pooled, catchGivenBlind: catchGivenBlind(pooled), catchGivenVisible: catchGivenVisible(pooled), symbolicVisible: rate(seeds.filter((r) => r.visible).length, seeds.length), symbolicVisibleBlocking: rate(seeds.filter((r) => r.visibleBlocking).length, seeds.length) },
    pooledUnitFailOnly: (() => { const c = twoByTwo(seeds, v1u); return { ...c, catchGivenBlind: catchGivenBlind(c), catchGivenVisible: catchGivenVisible(c) }; })(),
    bySource: {
      interp: { ...pooledInterp, catchGivenBlind: catchGivenBlind(pooledInterp).text, catchGivenVisible: catchGivenVisible(pooledInterp).text },
      'recorded-neo4j': { ...pooledRecorded, catchGivenBlind: catchGivenBlind(pooledRecorded).text, catchGivenVisible: catchGivenVisible(pooledRecorded).text },
    },
    byFamily: group(seeds, (r) => r.family),
    byStyle: group(seeds, (r) => r.style),
    byRound: group(seeds, (r) => r.round),
    v21BySplit: Object.fromEntries(['TUNE', 'CHECK'].map((sp) => {
      const c = twoByTwo(seeds.filter((r) => r.split === sp), v21);
      return [sp, { ...c, catchGivenBlind: catchGivenBlind(c).text, catchGivenVisible: catchGivenVisible(c).text }];
    })),
    twins: { ...twin2, judgeFalseFailGivenSymbolicQuiet: rate(twin2.blindCaught, twin2.blindCaught + twin2.blindMissed).text, judgeFalseFailGivenSymbolicAlarm: rate(twin2.visibleCaught, twin2.visibleCaught + twin2.visibleMissed).text, symbolicAlarm: rate(twins.filter((r) => r.visible).length, twins.length).text },
    cleanUnits: {
      judged: cleanJ.length,
      symbolicPass: cleanPass.length,
      judgeFalseFailGivenSymbolicPass: rate(cleanPass.filter((c) => c.judgeV1Fail === true).length, cleanPass.length),
      judgeFalseFailGivenSymbolicPassAll: rate(cleanPassAll.filter((c) => c.judgeV1Fail === true).length, cleanPassAll.length),
      judgeFalseFailGivenSymbolicBlockingFinding: rate(cleanJ.filter((c) => !c.symbolicPass && c.judgeV1Fail === true).length, cleanJ.filter((c) => !c.symbolicPass).length).text,
      v21FalseFailGivenSymbolicPass: Object.fromEntries(['TUNE', 'CHECK'].map((sp) => [sp, rate(cleanV21.filter((c) => c.split === sp && c.judgeV21Fail === true).length, cleanV21.filter((c) => c.split === sp).length).text])),
      failing: cleanPass.filter((c) => c.judgeV1Fail === true).map((c) => `${c.round} ${c.baseId} ${c.fn} ${c.unit}`),
    },
    bothMiss: seeds.filter((r) => !r.visible && r.judgeV1Catch === false).map((r) => `${r.round} ${r.rowId}`),
    judgeOnly: seeds.filter((r) => !r.visible && r.judgeV1Catch === true).map((r) => `${r.round} ${r.rowId}`),
    symbolicOnly: seeds.filter((r) => r.visible && r.judgeV1Catch === false).map((r) => `${r.round} ${r.rowId} [${r.hitRules}]`),
    engineCheck: {
      rows: agree.length,
      agree: agree.filter((r) => r.recordedVisible === r.visible).length,
      disagree: agree.filter((r) => r.recordedVisible !== r.visible).map((r) => `${r.round} ${r.rowId} interp=${String(r.visible)} recorded=${String(r.recordedVisible)}`),
      copyByteCheck: { checked: judgedRounds.filter((r) => r.copyByteCheck !== null).length, identical: judgedRounds.filter((r) => r.copyByteCheck === true).length, differ: judgedRounds.filter((r) => r.copyByteCheck === false).map((r) => r.rowId) },
    },
    check2: { note: 'symbolic arm only; judge v2.2 not run on CHECK-2 (pending the author run)', seeds: c2Seeds.length, visible: rate(c2Seeds.filter((r) => r.visible).length, c2Seeds.length).text, byFamily: c2Fam },
  };
}

function renderMd(s: Record<string, unknown>): string {
  const j = (x: unknown): string => JSON.stringify(x, null, 2);
  const lines = [
    '# Complementarity matrix: scores (generated by scripts/v1.3/complementarity.ts)',
    '',
    `> ${String(s.label)}`,
    '',
    '```json',
    j(s),
    '```',
    '',
  ];
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('complementarity.ts') === true) {
  process.exitCode = main(process.argv.slice(2), process.cwd());
}
