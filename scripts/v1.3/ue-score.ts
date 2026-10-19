/**
 * U-E baseline scoring (offline). Entry file: no exports. Reads the saved live outputs, the author-manifests, the
 * blind manifests (read-only, outside the repository) and the tool graphs, and writes the scores, the three-way
 * adjudication sheet and the graph agreement. Nothing is tuned: matching is the runner's (`compare.ts`), plus two
 * declared normalisations that are reported next to the literal figures.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/ue-score.ts --base results/v1.3-reference/baseline-pre-barrel --blind <daedalus-sealed/v1.3-blind>
 * Reads <base>/raw, <base>/evidence, <base>/graph/tool-graphs.json, <base>/blind-rule-mapping.json.
 * Writes <base>/scores.json, <base>/scores.md, <base>/adjudication.csv, <base>/graph/graph-agreement.json.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { compareVariant } from './lib/compare.js';
import type { ActualFinding } from './lib/compare.js';
import { loadAllReferences, postSealScopeOf } from './lib/reference-model.js';
import type { LoadedReference } from './lib/reference-model.js';
import { must } from './lib/must.js';

// ── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const arg = (name: string): string => {
  const i = argv.indexOf(name);
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (v === undefined) throw new Error(`${name} is required`);
  return v;
};
const BASE = path.resolve(arg('--base'));
const BLIND = path.resolve(arg('--blind'));

// ── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
  readonly reason?: string;
  readonly evidence?: string;
  /** Blind only: how the id was obtained. */
  readonly basis?: string;
  readonly confidence?: string;
  readonly tier?: string;
}

interface BlindFinding {
  ruleId: string; tier?: string; file: string; target?: string | null; reason: string; confidence?: string;
  alsoMatches?: string[]; note?: string; line?: number;
}
interface BlindEdge { from: string; to: string; kind: string; viaReExport?: boolean; through?: string[]; typeOnly?: boolean; specifier?: string }
interface BlindCase {
  style: string; case: string; verdict: string;
  expectedGraph: { files: { file: string; layer: string | null; context?: string | null }[]; edges: BlindEdge[]; unresolvedEdges: { from: string; specifier: string }[] };
  findings: BlindFinding[];
  nearMissOk: { nearMissOk: string; reason: string }[];
}
interface MappingRow { name: string; styles: string[]; ruleId: string | null; basis: string; note?: string }

interface Counts { tp: number; fn: number; fp: number; fpDistinct: number }
interface Rated extends Counts {
  recall: number | null; recallCI: [number, number] | null; precision: number | null; precisionCI: [number, number] | null;
  precisionDistinct: number | null; precisionDistinctCI: [number, number] | null;
}

// ── Statistics ───────────────────────────────────────────────────────────────

function wilson(k: number, n: number): [number, number] | null {
  if (n === 0) return null;
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
function rate(c: Counts): Rated {
  const r = (a: number, b: number): number | null => (b === 0 ? null : a / b);
  return {
    ...c,
    recall: r(c.tp, c.tp + c.fn), recallCI: wilson(c.tp, c.tp + c.fn),
    precision: r(c.tp, c.tp + c.fp), precisionCI: wilson(c.tp, c.tp + c.fp),
    precisionDistinct: r(c.tp, c.tp + c.fpDistinct), precisionDistinctCI: wilson(c.tp, c.tp + c.fpDistinct),
  };
}
const add = (a: Counts, b: Counts): Counts => ({ tp: a.tp + b.tp, fn: a.fn + b.fn, fp: a.fp + b.fp, fpDistinct: a.fpDistinct + b.fpDistinct });
const ZERO: Counts = { tp: 0, fn: 0, fp: 0, fpDistinct: 0 };

// ── Normalisation and matching ───────────────────────────────────────────────

/** FF-S02: the tool reports the cycle path ("a,b,a") in filePath; key a cycle on its sorted file set. */
function canon(f: Finding): Finding {
  if (f.ruleId !== 'FF-S02') return f;
  const files = [...new Set([...f.file.split(','), ...(f.target !== undefined && f.target !== '' ? f.target.split(',') : [])].map((s) => s.trim()).filter((s) => s !== ''))].sort();
  return { ...f, file: files[0] ?? f.file, target: files.slice(1).join(',') };
}
const fkey = (f: { ruleId: string; file: string; target?: string | undefined }): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;

/** One-to-one matching as in compare.ts: rule + file, target equal when both carry one; exact pairs first. */
function match(expected: readonly Finding[], actual: readonly Finding[]): { pairs: [number, number][]; fnIdx: number[]; fpIdx: number[] } {
  const used = new Array<boolean>(actual.length).fill(false);
  const m = new Array<number>(expected.length).fill(-1);
  for (const exactOnly of [true, false]) {
    expected.forEach((e, ei) => {
      if (m[ei] !== -1) return;
      const ai = actual.findIndex((a, i) => {
        if (used[i] || a.ruleId !== e.ruleId || a.file !== e.file) return false;
        const et = e.target ?? '';
        const at = a.target ?? '';
        if (et !== '' && at !== '') return et === at;
        return !exactOnly;
      });
      if (ai >= 0) { used[ai] = true; m[ei] = ai; }
    });
  }
  return {
    pairs: m.flatMap((ai, ei) => (ai >= 0 ? [[ei, ai] as [number, number]] : [])),
    fnIdx: m.flatMap((ai, ei) => (ai < 0 ? [ei] : [])),
    fpIdx: actual.flatMap((_, i) => (used[i] ? [] : [i])),
  };
}

// ── Loading ──────────────────────────────────────────────────────────────────

// v1.4 U2: the post-seal rules are compared only for outputs that were produced with them (each raw file's
// `postSealRules`, absent = false); a mixed set is refused.
const rawFlags = fs.readdirSync(path.join(BASE, 'raw')).filter((style) => fs.statSync(path.join(BASE, 'raw', style)).isDirectory()).flatMap((style) => fs.readdirSync(path.join(BASE, 'raw', style)).filter((f) => f.endsWith('.json'))
  .map((f) => (JSON.parse(fs.readFileSync(path.join(BASE, 'raw', style, f), 'utf8')) as { postSealRules?: boolean }).postSealRules));
const refs = loadAllReferences(process.cwd(), undefined, undefined, { postSeal: postSealScopeOf(rawFlags) });
const mapping = (JSON.parse(fs.readFileSync(path.join(BASE, 'blind-rule-mapping.json'), 'utf8')) as { mapping: MappingRow[] }).mapping;
const blindKey = JSON.parse(fs.readFileSync(path.join(BLIND, 'blind-key.json'), 'utf8')) as Record<string, string>;
const caseOf = new Map<string, string>(); // style/variant -> case-XX
for (const [k, v] of Object.entries(blindKey)) {
  const [style, c] = k.split('/');
  caseOf.set(`${style ?? ''}/${v}`, c ?? '');
}

function mapRule(style: string, name: string): { ruleId: string | null; basis: string } {
  if (/^FF-[A-Z]{1,3}[0-9]{2}$/.test(name)) return { ruleId: name, basis: 'id' };
  const row = mapping.find((r) => r.name === name && r.styles.includes(style));
  if (row === undefined) throw new Error(`no mapping for blind rule name ${JSON.stringify(name)} in ${style}; add it to blind-rule-mapping.json`);
  return { ruleId: row.ruleId, basis: row.basis };
}

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
}

interface Evidence { violations: Record<string, unknown>[] }
function toolRows(style: string, variant: string): Finding[] {
  const raw = (readJson(path.join(BASE, 'raw', style, `${variant}.json`)) as { findings: ActualFinding[] }).findings;
  const evPath = path.join(BASE, 'evidence', style, `${variant}.json`);
  const ev = fs.existsSync(evPath) ? (readJson(evPath) as Evidence).violations : [];
  const usedEv = new Set<number>();
  return raw.map((f) => {
    const i = ev.findIndex((v, j) => !usedEv.has(j) && v.functionId === f.ruleId && v.filePath === f.file && ((v.target as string | undefined) ?? '') === (f.target ?? ''));
    let evidence = `${f.ruleId} ${f.file}${f.target !== undefined ? ` -> ${f.target}` : ''}`;
    if (i >= 0) {
      usedEv.add(i);
      const v = must(ev[i], `evidence row ${String(i)}`);
      const parts = [`type=${String(v.type)}`, `message=${String(v.message)}`];
      if (typeof v.line === 'number') parts.push(`line=${String(v.line)}`);
      if (Array.isArray(v.evidence) && v.evidence.length > 0) parts.push(`evidence=${(v.evidence as unknown[]).map(String).join('; ')}`);
      if (Array.isArray(v.discriminator) && v.discriminator.length > 0) parts.push(`discriminator=${(v.discriminator as unknown[]).map(String).join('; ')}`);
      evidence = parts.join(' | ');
    }
    return { ruleId: f.ruleId, file: f.file, ...(f.target !== undefined ? { target: f.target } : {}), evidence };
  });
}

function blindCase(style: string, variant: string): BlindCase {
  const c = caseOf.get(`${style}/${variant}`);
  if (c === undefined) throw new Error(`no blind case for ${style}/${variant}`);
  return readJson(path.join(BLIND, 'blind-out', style, `${c}.json`)) as BlindCase;
}

const stripVia = (t: string | null | undefined): string | undefined => {
  if (t === null || t === undefined || t === '') return undefined;
  return t.replace(/\s*\(via [^)]*\)\s*$/, '');
};

interface BlindExpanded { scored: Finding[]; unscored: Finding[]; unmapped: Finding[] }
function blindFindings(style: string, bc: BlindCase, scope: ReadonlySet<string>, expand: boolean): BlindExpanded {
  const scored = new Map<string, Finding>();
  const unscored = new Map<string, Finding>();
  const unmapped: Finding[] = [];
  for (const f of bc.findings) {
    const target = stripVia(f.target);
    const names: { name: string; primary: boolean }[] = [{ name: f.ruleId, primary: true }, ...(expand ? (f.alsoMatches ?? []).map((n) => ({ name: n, primary: false })) : [])];
    for (const { name, primary } of names) {
      const { ruleId, basis } = mapRule(style, name);
      const reason = `${f.reason}${f.note !== undefined ? ` Note: ${f.note}` : ''}`;
      const base: Finding = {
        ruleId: ruleId ?? name, file: f.file, ...(target !== undefined ? { target } : {}), reason,
        basis: `${primary ? 'primary' : `alsoMatches of ${f.ruleId}`}${basis === 'id' ? '' : `; name '${name}' mapped (${basis})`}`,
        ...(f.confidence !== undefined ? { confidence: f.confidence } : {}), ...(f.tier !== undefined ? { tier: f.tier } : {}),
      };
      const c = canon(base);
      if (ruleId === null) { if (primary) unmapped.push(c); continue; }
      const bucket = scope.has(ruleId) ? scored : unscored;
      const k = fkey(c);
      const prev = bucket.get(k);
      if (prev === undefined || (primary && !(prev.basis ?? '').startsWith('primary'))) bucket.set(k, c);
    }
  }
  return { scored: [...scored.values()], unscored: [...unscored.values()], unmapped };
}

// ── Finding-level scoring ────────────────────────────────────────────────────

interface StyleScore {
  style: string;
  view: string;
  blocking: Rated; all: Rated;
  perRule: { ruleId: string; ruleName: string; blocking: boolean; counts: Rated }[];
  plantedDetected?: { k: number; n: number };
  violationCasesWithBlockingHit?: { k: number; n: number };
}

const scoresOut: { views: StyleScore[]; nearMiss: unknown[]; negativeControl: unknown[]; manifestAgreement: unknown[]; unscoredBlind: unknown[]; guessedMappingsUsed: unknown[] } = {
  views: [], nearMiss: [], negativeControl: [], manifestAgreement: [], unscoredBlind: [], guessedMappingsUsed: [],
};

type ExpectedOf = (ref: LoadedReference, variant: string) => Finding[];

function scoreView(view: string, ref: LoadedReference, expectedOf: ExpectedOf, normalise: boolean): StyleScore {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const blockingSet = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
  const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
  const cleanKeys = new Set<string>();
  if (clean !== undefined) for (const a of toolRows(ref.style, clean.manifest.variant)) if (scope.has(a.ruleId)) cleanKeys.add(fkey(normalise ? canon(a) : a));
  const per = new Map<string, Counts>();
  for (const r of ref.descriptor.scopeRules) per.set(r.ruleId, { ...ZERO });
  let planted = 0;
  let violations = 0;
  let blockingHit = 0;
  for (const v of ref.variants) {
    const actual = toolRows(ref.style, v.manifest.variant).filter((a) => scope.has(a.ruleId)).map((a) => (normalise ? canon(a) : a));
    const expected = expectedOf(ref, v.manifest.variant).filter((e) => scope.has(e.ruleId));
    const { pairs, fnIdx, fpIdx } = match(expected, actual);
    const exp = (ei: number): (typeof expected)[number] => must(expected[ei], `expected finding ${String(ei)}`);
    const countsOf = (ruleId: string): Counts => must(per.get(ruleId), `counts of ${ruleId}`);
    for (const [ei] of pairs) { const c = countsOf(exp(ei).ruleId); c.tp += 1; }
    for (const ei of fnIdx) { const c = countsOf(exp(ei).ruleId); c.fn += 1; }
    for (const ai of fpIdx) {
      const a = must(actual[ai], `actual finding ${String(ai)}`);
      const c = countsOf(a.ruleId);
      c.fp += 1;
      if (v.manifest.kind === 'clean' || !cleanKeys.has(fkey(a))) c.fpDistinct += 1;
    }
    if (v.manifest.kind === 'violation') {
      violations += 1;
      if (pairs.some(([ei]) => exp(ei).ruleId === v.manifest.plants)) planted += 1;
      if (pairs.some(([ei]) => blockingSet.has(exp(ei).ruleId))) blockingHit += 1;
    }
  }
  const rules = ref.descriptor.scopeRules.map((r) => ({ ruleId: r.ruleId, ruleName: r.ruleName, blocking: r.blockingCandidate, counts: rate(must(per.get(r.ruleId), `counts of ${r.ruleId}`)) }));
  const pool = (sel: (r: (typeof rules)[number]) => boolean): Rated => rate(rules.filter(sel).reduce<Counts>((s, r) => add(s, r.counts), { ...ZERO }));
  return {
    style: ref.style, view, blocking: pool((r) => r.blocking), all: pool(() => true), perRule: rules,
    plantedDetected: { k: planted, n: violations }, violationCasesWithBlockingHit: { k: blockingHit, n: violations },
  };
}

const authorExpected: ExpectedOf = (ref, variant) => {
  const v = must(ref.variants.find((x) => x.manifest.variant === variant), `${ref.style}/${variant}`);
  return v.manifest.expectedFindings.map((e) => ({ ruleId: e.ruleId, file: e.file, ...(e.target !== undefined ? { target: e.target } : {}), reason: e.reason }));
};
const authorExpectedCanon: ExpectedOf = (ref, variant) => authorExpected(ref, variant).map(canon);
const blindExpected = (expand: boolean): ExpectedOf => (ref, variant) => {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  return blindFindings(ref.style, blindCase(ref.style, variant), scope, expand).scored;
};

for (const ref of refs) {
  // The literal runner view must equal report.json: recompute it with compare.ts itself as a check.
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const cleanV = ref.variants.find((v) => v.manifest.kind === 'clean');
  const cleanActual = cleanV === undefined ? undefined : toolRows(ref.style, cleanV.manifest.variant);
  for (const v of ref.variants) compareVariant(ref.style, v.manifest, toolRows(ref.style, v.manifest.variant), scope, cleanActual);
  scoresOut.views.push(scoreView('author-literal', ref, authorExpected, false));
  scoresOut.views.push(scoreView('author-cycle-normalised', ref, authorExpectedCanon, true));
  scoresOut.views.push(scoreView('blind-expanded', ref, blindExpected(true), true));
  scoresOut.views.push(scoreView('blind-primary', ref, blindExpected(false), true));
}

// Near-misses and the negative control (clean variant), under each manifest.
for (const ref of refs) {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const blockingSet = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
  const clean = must(ref.variants.find((v) => v.manifest.kind === 'clean'), `${ref.style} clean variant`);
  const cleanRows = toolRows(ref.style, clean.manifest.variant).filter((a) => scope.has(a.ruleId)).map(canon);
  const cleanKeys = new Set(cleanRows.map(fkey));
  const bClean = blindFindings(ref.style, blindCase(ref.style, clean.manifest.variant), scope, true);
  scoresOut.negativeControl.push({
    style: ref.style, case: caseOf.get(`${ref.style}/clean`),
    toolScoredRows: cleanRows.length, toolBlockingRows: cleanRows.filter((r) => blockingSet.has(r.ruleId)).length,
    rows: cleanRows.map((r) => ({ ruleId: r.ruleId, file: r.file, target: r.target ?? '', blocking: blockingSet.has(r.ruleId) })),
    authorExpected: authorExpected(ref, 'clean').length, blindExpectedScored: bClean.scored.length, blindVerdict: blindCase(ref.style, 'clean').verdict,
    toolBlockingVerdict: cleanRows.some((r) => blockingSet.has(r.ruleId)) ? 'fail' : 'pass',
  });
  const nm = ref.variants.filter((v) => v.manifest.kind === 'near-miss');
  const rowsOf = nm.map((v) => {
    const actual = toolRows(ref.style, v.manifest.variant).filter((a) => scope.has(a.ruleId)).map(canon);
    const bf = blindFindings(ref.style, blindCase(ref.style, v.manifest.variant), scope, true).scored;
    const unexpectedAuthor = actual; // near-miss author manifests expect nothing
    const unexpectedBlind = match(bf, actual).fpIdx.map((i) => must(actual[i], `actual finding ${String(i)}`));
    return {
      variant: v.manifest.variant, case: caseOf.get(`${ref.style}/${v.manifest.variant}`),
      rows: unexpectedAuthor.map((r) => ({ ruleId: r.ruleId, file: r.file, target: r.target ?? '', blocking: blockingSet.has(r.ruleId), alsoOnClean: cleanKeys.has(fkey(r)) })),
      blindExpected: bf.map((b) => ({ ruleId: b.ruleId, file: b.file, target: b.target ?? '' })),
      unexpectedVsBlind: unexpectedBlind.length,
    };
  });
  const anyFp = (sel: (r: { blocking: boolean; alsoOnClean: boolean }) => boolean): number => rowsOf.filter((x) => x.rows.some(sel)).length;
  scoresOut.nearMiss.push({
    style: ref.style, nearMisses: nm.length,
    withAnyScoredFp: anyFp(() => true), withBlockingFp: anyFp((r) => r.blocking),
    withNewFp: anyFp((r) => !r.alsoOnClean), withNewBlockingFp: anyFp((r) => r.blocking && !r.alsoOnClean),
    detail: rowsOf,
  });
}

// Author-manifest against blind-manifest (scored rules, expanded, cycle-normalised).
for (const ref of refs) {
  let both = 0;
  let authorOnly = 0;
  let blindOnly = 0;
  let bothBlocking = 0;
  let authorOnlyBlocking = 0;
  let blindOnlyBlocking = 0;
  const blockingSet = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
  let verdictAgree = 0;
  for (const v of ref.variants) {
    const a = authorExpectedCanon(ref, v.manifest.variant).filter((e) => new Set(ref.descriptor.scopeRules.map((r) => r.ruleId)).has(e.ruleId));
    const b = blindExpected(true)(ref, v.manifest.variant);
    const { pairs, fnIdx, fpIdx } = match(a, b);
    both += pairs.length; authorOnly += fnIdx.length; blindOnly += fpIdx.length;
    bothBlocking += pairs.filter(([ei]) => blockingSet.has(must(a[ei], 'author finding').ruleId)).length;
    authorOnlyBlocking += fnIdx.filter((i) => blockingSet.has(must(a[i], 'author finding').ruleId)).length;
    blindOnlyBlocking += fpIdx.filter((i) => blockingSet.has(must(b[i], 'blind finding').ruleId)).length;
    const authorFail = a.some((e) => blockingSet.has(e.ruleId));
    const blindFail = blindCase(ref.style, v.manifest.variant).verdict === 'fail';
    if (authorFail === blindFail) verdictAgree += 1;
  }
  scoresOut.manifestAgreement.push({ style: ref.style, both, authorOnly, blindOnly, bothBlocking, authorOnlyBlocking, blindOnlyBlocking, caseVerdictAgree: verdictAgree, cases: ref.variants.length });
}

// Blind findings that could not be scored, and the guessed mappings that were used.
for (const ref of refs) {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  for (const v of ref.variants) {
    const bc = blindCase(ref.style, v.manifest.variant);
    const bf = blindFindings(ref.style, bc, scope, true);
    for (const u of [...bf.unscored, ...bf.unmapped]) scoresOut.unscoredBlind.push({ style: ref.style, case: bc.case, variant: v.manifest.variant, ruleId: u.ruleId, file: u.file, basis: u.basis });
    for (const s of [...bf.scored, ...bf.unscored]) if ((s.basis ?? '').includes('(guessed)')) scoresOut.guessedMappingsUsed.push({ style: ref.style, case: bc.case, variant: v.manifest.variant, ruleId: s.ruleId, file: s.file, basis: s.basis });
  }
}

// ── Three-way adjudication sheet ─────────────────────────────────────────────

interface Entry { src: 'tool' | 'author' | 'blind'; f: Finding; scoped: boolean; unmapped?: boolean }
const csvRows: string[][] = [];
const header = ['style', 'case', 'variant', 'kind', 'plants', 'rule', 'tier', 'scope', 'file', 'target', 'tool', 'author', 'blind', 'pattern', 'tool_evidence', 'author_reason', 'blind_reason', 'blind_basis', 'blind_confidence', 'blind_nearMissOk', 'adjudication', 'adjudication_note'];
for (const ref of refs) {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const tierOf = new Map(ref.descriptor.scopeRules.map((r) => [r.ruleId, r.blockingCandidate ? 'blocking' : 'advisory']));
  for (const v of ref.variants) {
    const bc = blindCase(ref.style, v.manifest.variant);
    const bf = blindFindings(ref.style, bc, scope, true);
    const blindRuleIds = new Set([...bf.unscored, ...bf.unmapped].map((x) => x.ruleId));
    const tool = toolRows(ref.style, v.manifest.variant).map(canon);
    const entries: Entry[] = [
      ...tool.filter((t) => scope.has(t.ruleId) || blindRuleIds.has(t.ruleId)).map((f) => ({ src: 'tool' as const, f, scoped: scope.has(f.ruleId) })),
      ...authorExpectedCanon(ref, v.manifest.variant).map((f) => ({ src: 'author' as const, f, scoped: scope.has(f.ruleId) })),
      ...bf.scored.map((f) => ({ src: 'blind' as const, f, scoped: true })),
      ...bf.unscored.map((f) => ({ src: 'blind' as const, f, scoped: false })),
      ...bf.unmapped.map((f) => ({ src: 'blind' as const, f, scoped: false, unmapped: true })),
    ];
    // Group by rule + file, then by target (target-less entries join the only target when there is one).
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = `${e.f.ruleId}|${e.f.file}`;
      const g = groups.get(k) ?? [];
      g.push(e);
      groups.set(k, g);
    }
    for (const g of groups.values()) {
      const targets = [...new Set(g.map((e) => e.f.target ?? '').filter((t) => t !== ''))];
      const buckets = new Map<string, Entry[]>();
      for (const e of g) {
        const t = e.f.target ?? '';
        const k = t !== '' ? t : targets.length === 1 ? (targets[0] ?? '') : '';
        const b = buckets.get(k) ?? [];
        b.push(e);
        buckets.set(k, b);
      }
      for (const [target, es] of buckets) {
        const has = (s: Entry['src']): Entry[] => es.filter((e) => e.src === s);
        const t = has('tool');
        const a = has('author');
        const b = has('blind');
        if (t.length > 0 && a.length > 0 && b.length > 0 && t.length === a.length && a.length === b.length) continue;
        const first = must(es[0], `bucket ${target}`);
        const rule = first.f.ruleId;
        const scopeLabel = first.unmapped === true ? 'unmapped' : es.some((e) => e.scoped) ? 'scored' : 'unscored';
        const nm = bc.nearMissOk.filter((n) => n.nearMissOk === first.f.file || picomatch(n.nearMissOk, { dot: true })(first.f.file));
        const verdict = (xs: Entry[], src: string): string => {
          if (src === 'tool' && scopeLabel === 'unmapped') return 'n/a';
          if (xs.length === 0) return 'none';
          return xs.length === 1 ? 'finding' : `finding x${String(xs.length)}`;
        };
        const tv = verdict(t, 'tool');
        const av = verdict(a, 'author');
        const bv = verdict(b, 'blind');
        const present = [tv, av, bv].map((x) => x.startsWith('finding'));
        const pattern = tv === 'n/a' ? 'blind only (unmapped construct)'
          : present[0] && !present[1] && !present[2] ? 'tool only'
          : !present[0] && present[1] && present[2] ? 'both manifests, tool silent'
          : !present[0] && present[1] && !present[2] ? 'author only'
          : !present[0] && !present[1] && present[2] ? 'blind only'
          : present[0] && present[1] && !present[2] ? 'tool + author, blind silent'
          : present[0] && !present[1] && present[2] ? 'tool + blind, author silent'
          : 'all three, count differs';
        csvRows.push([
          ref.style, bc.case, v.manifest.variant, v.manifest.kind, v.manifest.plants ?? '', rule, tierOf.get(rule) ?? (scopeLabel === 'unmapped' ? '' : 'not compared'), scopeLabel,
          first.f.file, target, tv, av, bv, pattern,
          t.map((e) => e.f.evidence ?? '').join(' || '),
          a.map((e) => e.f.reason ?? '').join(' || '),
          b.map((e) => e.f.reason ?? '').join(' || '),
          b.map((e) => e.f.basis ?? '').join(' || '),
          b.map((e) => e.f.confidence ?? '').join(' || '),
          nm.map((n) => `${n.nearMissOk}: ${n.reason}`).join(' || '),
          '', '',
        ]);
      }
    }
  }
}
const csvCell = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
fs.writeFileSync(path.join(BASE, 'adjudication.csv'), [header, ...csvRows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n');

// ── Graph agreement ──────────────────────────────────────────────────────────

interface ToolGraph { files: { file: string; layer: string | null }[]; edges: { from: string; to: string; types: string[] }[] }
const toolGraphs = readJson(path.join(BASE, 'graph', 'tool-graphs.json')) as Record<string, Record<string, ToolGraph>>;
const ek = (f: string, t: string): string => `${f} -> ${t}`;

interface GraphCounts { both: number; onlyTool: number; onlyRef: number; onlyToolExcluded: number }
const graphOut: Record<string, unknown> = { vsAuthor: [] as unknown[], vsBlind: [] as unknown[], examples: [] as unknown[] };
for (const ref of refs) {
  const tg = must(toolGraphs[ref.style], `tool graphs of ${ref.style}`);
  // vs author expected graph (clean variant only).
  const cleanTool = must(tg.clean, `${ref.style} clean tool graph`);
  const toolE = new Set(cleanTool.edges.map((e) => ek(e.from, e.to)));
  const toolLayer = new Map(cleanTool.files.map((f) => [f.file, f.layer]));
  const eg = JSON.parse(fs.readFileSync(path.join(ref.dir, 'expected-graph.json'), 'utf8')) as Record<string, unknown>;
  let layerAgree = 0;
  let layerTotal = 0;
  const layerMismatch: string[] = [];
  const efiles: [string, string | null][] = Array.isArray(eg.files)
    ? (eg.files as { path: string; layer: string | null }[]).map((f) => [f.path, f.layer])
    : Object.entries(eg.files as Record<string, { layer: string | null }>).map(([p, x]) => [p, x.layer]);
  for (const [p, l] of efiles) {
    layerTotal += 1;
    if ((toolLayer.get(p) ?? null) === l && toolLayer.has(p)) layerAgree += 1;
    else layerMismatch.push(`${p}: expected ${String(l)}, tool ${toolLayer.get(p) ?? 'absent'}`);
  }
  if (ref.format === 'patch') {
    const authE = new Set((eg.edges as { from: string; to: string }[]).map((e) => ek(e.from, e.to)));
    const both = [...authE].filter((e) => toolE.has(e)).length;
    (graphOut.vsAuthor as unknown[]).push({
      style: ref.style, kind: 'every edge', refEdges: authE.size, toolEdges: toolE.size, both,
      recall: both / authE.size, precision: both / toolE.size,
      onlyTool: [...toolE].filter((e) => !authE.has(e)), onlyRef: [...authE].filter((e) => !toolE.has(e)),
      layer: { agree: layerAgree, total: layerTotal, mismatches: layerMismatch },
    });
  } else {
    const key = (eg.keyEdges as { from: string; to: string }[]).map((e) => ek(e.from, e.to));
    const present = key.filter((e) => toolE.has(e));
    (graphOut.vsAuthor as unknown[]).push({
      style: ref.style, kind: 'key edges only', refEdges: key.length, both: present.length, recall: present.length / key.length,
      precision: null, onlyRef: key.filter((e) => !toolE.has(e)), layer: { agree: layerAgree, total: layerTotal, mismatches: layerMismatch },
    });
  }

  // vs blind expected graph, every case.
  const lit: GraphCounts = { both: 0, onlyTool: 0, onlyRef: 0, onlyToolExcluded: 0 };
  const via = { refEdges: 0, inTool: 0 };
  let lAgree = 0;
  let lTotal = 0;
  let toolOnlyFiles = 0;
  const onlyToolClasses: Record<string, number> = {};
  const onlyRefClasses: Record<string, number> = {};
  const layerMis: Record<string, number> = {};
  for (const v of ref.variants) {
    const bc = blindCase(ref.style, v.manifest.variant);
    const t = must(tg[v.manifest.variant], `${ref.style}/${v.manifest.variant} tool graph`);
    const tE = new Set(t.edges.map((e) => ek(e.from, e.to)));
    const literal = new Set(bc.expectedGraph.edges.filter((e) => e.viaReExport !== true).map((e) => ek(e.from, e.to)));
    const viaE = new Set(bc.expectedGraph.edges.filter((e) => e.viaReExport === true).map((e) => ek(e.from, e.to)));
    const barrelLiteral = new Set(bc.expectedGraph.edges.filter((e) => e.viaReExport === true).flatMap((e) => (e.through ?? []).map((th) => ek(e.from, th))));
    const unresolvedFrom = new Set(bc.expectedGraph.unresolvedEdges.map((u) => u.from));
    const blindFiles = new Set(bc.expectedGraph.files.map((f) => f.file));
    for (const e of literal) {
      if (tE.has(e)) lit.both += 1;
      else {
        lit.onlyRef += 1;
        const cls = barrelLiteral.has(e) ? 'barrel import: tool has no edge to the barrel file (routed to the declaring file)' : 'other';
        onlyRefClasses[cls] = (onlyRefClasses[cls] ?? 0) + 1;
        if ((graphOut.examples as unknown[]).length < 400) (graphOut.examples as unknown[]).push({ style: ref.style, case: bc.case, variant: v.manifest.variant, side: 'blind literal edge missing in tool', edge: e, class: cls });
      }
    }
    for (const e of tE) {
      if (literal.has(e)) continue;
      const [from, to] = e.split(' -> ') as [string, string];
      let cls: string;
      if (!blindFiles.has(from) || (!blindFiles.has(to) && unresolvedFrom.has(from))) cls = 'target missing from the blind package (hexagonal ports/out), recorded there as unresolved';
      else if (viaE.has(e)) cls = 'barrel-routed edge (equals a blind viaReExport edge)';
      else cls = 'other';
      onlyToolClasses[cls] = (onlyToolClasses[cls] ?? 0) + 1;
      if (cls.startsWith('target missing')) lit.onlyToolExcluded += 1;
      else lit.onlyTool += 1;
      if (cls !== 'target missing from the blind package (hexagonal ports/out), recorded there as unresolved' && (graphOut.examples as unknown[]).length < 400) (graphOut.examples as unknown[]).push({ style: ref.style, case: bc.case, variant: v.manifest.variant, side: 'tool edge not a blind literal edge', edge: e, class: cls });
    }
    via.refEdges += viaE.size;
    via.inTool += [...viaE].filter((e) => tE.has(e)).length;
    const tl = new Map(t.files.map((f) => [f.file, f.layer]));
    for (const f of bc.expectedGraph.files) {
      lTotal += 1;
      const bl = f.layer === 'unassigned' ? null : f.layer ?? null;
      if (tl.has(f.file) && (tl.get(f.file) ?? null) === bl) lAgree += 1;
      else { const k = `${f.file}: blind ${String(f.layer)}, tool ${tl.has(f.file) ? String(tl.get(f.file)) : 'absent'}`; layerMis[k] = (layerMis[k] ?? 0) + 1; }
    }
    toolOnlyFiles += t.files.filter((f) => !blindFiles.has(f.file)).length;
  }
  const refTotal = lit.both + lit.onlyRef;
  (graphOut.vsBlind as unknown[]).push({
    style: ref.style, cases: ref.variants.length,
    literal: {
      ...lit, recall: lit.both / refTotal, recallCI: wilson(lit.both, refTotal),
      precision: lit.both / (lit.both + lit.onlyTool), precisionCI: wilson(lit.both, lit.both + lit.onlyTool),
      precisionIncludingPackageDefect: lit.both / (lit.both + lit.onlyTool + lit.onlyToolExcluded),
    },
    viaReExport: { ...via, recall: via.refEdges === 0 ? null : via.inTool / via.refEdges },
    onlyToolClasses, onlyRefClasses,
    layer: { agree: lAgree, total: lTotal, accuracy: lAgree / lTotal, toolOnlyFiles, mismatches: layerMis },
  });
}
fs.mkdirSync(path.join(BASE, 'graph'), { recursive: true });
fs.writeFileSync(path.join(BASE, 'graph', 'graph-agreement.json'), JSON.stringify(graphOut, null, 1) + '\n');

// ── Outputs ──────────────────────────────────────────────────────────────────

fs.writeFileSync(path.join(BASE, 'scores.json'), JSON.stringify({ ...scoresOut, adjudicationRows: csvRows.length }, null, 1) + '\n');

const f2 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(2));
const ci = (x: [number, number] | null): string => (x === null ? '' : ` [${x[0].toFixed(2)}, ${x[1].toFixed(2)}]`);
const md: string[] = ['# U-E baseline scores (generated by scripts/v1.3/ue-score.ts)', ''];
for (const view of ['author-literal', 'author-cycle-normalised', 'blind-expanded', 'blind-primary']) {
  md.push(`## ${view}`, '', '| Style | Blocking recall | TP/(TP+FN) | Blocking precision | TP/(TP+FP) | Precision distinct | All recall | All precision | Planted detected |', '|---|---|---|---|---|---|---|---|---|');
  for (const s of scoresOut.views.filter((x) => x.view === view)) {
    md.push(`| ${s.style} | ${f2(s.blocking.recall)}${ci(s.blocking.recallCI)} | ${String(s.blocking.tp)}/${String(s.blocking.tp + s.blocking.fn)} | ${f2(s.blocking.precision)}${ci(s.blocking.precisionCI)} | ${String(s.blocking.tp)}/${String(s.blocking.tp + s.blocking.fp)} | ${f2(s.blocking.precisionDistinct)}${ci(s.blocking.precisionDistinctCI)} | ${f2(s.all.recall)}${ci(s.all.recallCI)} | ${f2(s.all.precision)}${ci(s.all.precisionCI)} | ${String(s.plantedDetected?.k ?? 0)}/${String(s.plantedDetected?.n ?? 0)} |`);
  }
  const tot = scoresOut.views.filter((x) => x.view === view).reduce<Counts>((a, s) => add(a, s.blocking), { ...ZERO });
  const r = rate(tot);
  md.push(`| **pooled** | ${f2(r.recall)}${ci(r.recallCI)} | ${String(tot.tp)}/${String(tot.tp + tot.fn)} | ${f2(r.precision)}${ci(r.precisionCI)} | ${String(tot.tp)}/${String(tot.tp + tot.fp)} | ${f2(r.precisionDistinct)}${ci(r.precisionDistinctCI)} | | | |`, '');
  md.push('| Style | Rule | Tier | TP | FN | FP | FP distinct | Recall | Precision |', '|---|---|---|---|---|---|---|---|---|');
  for (const s of scoresOut.views.filter((x) => x.view === view)) {
    for (const r2 of s.perRule) {
      const c = r2.counts;
      if (c.tp + c.fn + c.fp === 0) continue;
      md.push(`| ${s.style} | ${r2.ruleId} ${r2.ruleName} | ${r2.blocking ? 'blocking' : 'advisory'} | ${String(c.tp)} | ${String(c.fn)} | ${String(c.fp)} | ${String(c.fpDistinct)} | ${f2(c.recall)}${ci(c.recallCI)} | ${f2(c.precision)}${ci(c.precisionCI)} |`);
    }
  }
  md.push('');
}
md.push(`Adjudication rows: ${String(csvRows.length)}`, '');
fs.writeFileSync(path.join(BASE, 'scores.md'), md.join('\n') + '\n');
process.stdout.write(md.join('\n') + '\n');
