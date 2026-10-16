/**
 * v1.3 fidelity adjudication prep (pure part): per-row proposed verdicts for the graph-fidelity adjudication sheets,
 * the "proposed, not adjudicated" precision and recall, and the seeded author review sample. Reads nothing from disk:
 * the caller passes the source text of the cited files.
 *
 * Never fills `human_verdict` or `adjudication`; those belong to the author.
 */
import picomatch from 'picomatch';
import { cmp, mulberry32 } from './graph-fidelity.js';

// ── Vocabulary ───────────────────────────────────────────────────────────────

export type ProposedVerdict = 'tool-correct' | 'reference-correct' | 'both-acceptable';
export type ProposedClass = 'alias' | 'dynamic' | 'type-only' | 're-export' | 'out-of-root' | 'tool-bug' | 'reference-bug' | 'other';
/**
 * What the proposed verdict says about the edge itself, so that every APG variant can be scored from one verdict:
 * `required` = the code has this file-to-file import; `acceptable` = a real dependency the graph may show or omit
 * (declaration-level routing, outside the extraction scope); `absent` = the code has no such import.
 */
export type EdgeStatus = 'required' | 'acceptable' | 'absent';

export const PROPOSED_COLUMNS = ['proposed_verdict', 'proposed_class', 'evidence', 'proposed_edge_status', 'proposed_rule'] as const;

export interface Proposal {
  readonly verdict: ProposedVerdict;
  readonly cls: ProposedClass;
  readonly evidence: string;
  readonly status: EdgeStatus;
  /** The class rule that produced the proposal; every row it covers was checked mechanically. */
  readonly rule: string;
}

/** One row of a graph-fidelity `adjudication.csv`, header-keyed. */
export type SheetRow = Readonly<Record<string, string>>;

/** One edge of a per-project `projects/<id>.csv`. */
export interface ProjectEdge {
  readonly source: string;
  readonly target: string;
  readonly scope: string;
  readonly tscKinds: readonly string[];
  readonly specifiers: readonly string[];
  /** `in_<variant>` flags, keyed by variant name (`apg-v12e-default`, `depcruise`, `tsc`, ...). */
  readonly present: Readonly<Record<string, boolean>>;
}

export interface ProjectContext {
  /** Text of a project file (path relative to the project root, `../` allowed), or undefined if not available. */
  readonly read: (relPath: string) => string | undefined;
  /** Where the file text comes from, for the evidence line (e.g. `upstream@c1c2cc4`). */
  readonly sourceLabel: string;
  readonly edges: readonly ProjectEdge[];
  readonly specExcludes: readonly string[];
  /** Files the APG holds as File nodes, when known (from the per-project edge list). */
  readonly apgFiles: ReadonlySet<string>;
}

// ── Source helpers ───────────────────────────────────────────────────────────

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();
const quote = (s: string, max = 140): string => {
  const t = oneLine(s);
  return '`' + (t.length > max ? `${t.slice(0, max - 1)}…` : t).replace(/`/g, "'") + '`';
};

/** The import/export statement that holds `line` (1-based): walks back to its first line and forward to `from`. */
export function statementAt(text: string, line: number): string {
  const lines = text.split('\n');
  let start = line - 1;
  for (let i = line - 1; i >= Math.max(0, line - 40); i--) {
    if (/^\s*(import|export)\b/.test(lines[i] ?? '')) { start = i; break; }
  }
  let end = line - 1;
  for (let i = start; i < Math.min(lines.length, start + 60); i++) {
    end = i;
    if (/\bfrom\s*['"]|require\s*\(|import\s*\(|^\s*import\s*['"]/.test(lines[i] ?? '') && i >= line - 1) break;
  }
  return lines.slice(start, end + 1).join('\n');
}

/** The names a static import statement binds (original names, not local aliases). `*` for a namespace import. */
export function importedNames(statement: string): string[] {
  const s = statement.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const names: string[] = [];
  const braces = /\{([^}]*)\}/.exec(s);
  if (braces) {
    for (const part of (braces[1] ?? '').split(',')) {
      const p = part.trim().replace(/^type\s+/, '');
      if (p === '') continue;
      names.push((p.split(/\s+as\s+/)[0] ?? p).trim());
    }
  }
  if (/import\s+(type\s+)?([\w$]+\s*,\s*)?\*\s+as\s+[\w$]+/.test(s) || /export\s+\*/.test(s)) names.push('*');
  const def = /import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(,|from)/.exec(s);
  if (def?.[1] !== undefined && def[1] !== 'type') names.push('default');
  return names;
}

/** True when the file text declares (not merely re-exports) `name` as an export. */
export function declaresExport(text: string, name: string): boolean {
  if (name === 'default') return /export\s+default\b|export\s*=/.test(text);
  if (name === '*') return /export\s+(declare\s+)?(default\s+)?(abstract\s+)?(class|interface|type|enum|const|let|var|function|async\s+function|namespace)\b/.test(text);
  const n = name.replace(/[$]/g, '\\$');
  const decl = new RegExp(`export\\s+(declare\\s+)?(default\\s+)?(abstract\\s+)?(class|interface|type|enum|const\\s+enum|const|let|var|function\\*?|async\\s+function|namespace)\\s+${n}\\b`);
  if (decl.test(text)) return true;
  // `export { X }` / `export { Y as X }` without a `from` clause: a local declaration exported later.
  for (const m of text.matchAll(/export\s*(type\s*)?\{([^}]*)\}\s*(?!\s*from)(;|\n|$)/g)) {
    if ((m[2] ?? '').split(',').some((p) => (p.split(/\s+as\s+/).pop() ?? '').trim() === name)) return true;
  }
  return false;
}

const lineOf = (text: string | undefined, n: number): string | undefined => text?.split('\n')[n - 1];

// ── Barrel chains ────────────────────────────────────────────────────────────

const isReExport = (e: ProjectEdge): boolean => e.tscKinds.some((k) => k.includes('re-export'));

/** Re-export path from `barrel` to `target` over the tsc re-export edges, or undefined. */
export function reExportChain(barrel: string, target: string, edges: readonly ProjectEdge[]): string[] | undefined {
  const out = new Map<string, string[]>();
  for (const e of edges) if (isReExport(e)) out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  const prev = new Map<string, string>([[barrel, '']]);
  const queue = [barrel];
  while (queue.length > 0) {
    const cur = queue.shift() ?? '';
    if (cur === target) {
      const path = [cur];
      let p = prev.get(cur) ?? '';
      while (p !== '') { path.unshift(p); p = prev.get(p) ?? ''; }
      return path;
    }
    for (const n of out.get(cur) ?? []) if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
  }
  return undefined;
}

// ── Classification ───────────────────────────────────────────────────────────

/** The disagreement reason of the row: the tsc class of the v1.2E default APG, else the dependency-cruiser class. */
export function rowReason(row: SheetRow): { side: 'apg' | 'ref' | ''; reason: string } {
  const tsc = row['class_apg-v12e-default_vs_tsc'] ?? '';
  const pick = tsc !== '' ? tsc : row['class_apg-v12e-default_vs_depcruise'] ?? '';
  const m = /^missing-in-(apg|ref):(.*)$/.exec(pick);
  if (!m) return { side: '', reason: '' };
  return { side: m[1] as 'apg' | 'ref', reason: (m[2] ?? '').replace(/ \(by-design\)$/, '') };
}

const STRATUM_CLASS: Readonly<Record<string, ProposedClass>> = {
  'path-alias': 'alias', 'type-only': 'type-only', 're-export': 're-export', dynamic: 'dynamic', require: 'dynamic',
};

/**
 * Proposes a verdict for one sheet row. `proposed_verdict` is relative to the frozen v1.2E default APG (the variant
 * the sheet's class columns describe); `proposed_edge_status` scores every other variant.
 */
export function propose(row: SheetRow, ctx: ProjectContext): Proposal {
  const src = row.source ?? '';
  const tgt = row.target ?? '';
  const line = Number(row.line ?? '0');
  const cited = row.source_line_text ?? '';
  const srcText = ctx.read(src);
  const actual = lineOf(srcText, line);
  const lineCheck = srcText === undefined
    ? `source not in the container; harness quote ${src}:${String(line)} ${quote(cited)}`
    : actual !== undefined && oneLine(actual) === oneLine(cited)
      ? `${src}:${String(line)} ${quote(actual)} (${ctx.sourceLabel})`
      : `LINE MISMATCH at ${src}:${String(line)}: sheet ${quote(cited)} vs file ${quote(actual ?? '<no such line>')}`;
  const mismatch = lineCheck.startsWith('LINE MISMATCH');
  const flag = (why: string): Proposal => ({ verdict: 'reference-correct', cls: 'other', status: 'required', rule: 'R-unverified', evidence: `${lineCheck} — CHECK FAILED: ${why}; needs the author` });
  if (mismatch) return flag('cited line does not match the source');

  const specifier = row.specifier ?? '';
  const excluded = (p: string): string | undefined => ctx.specExcludes.find((g) => picomatch(g, { dot: true })(p));
  const vTsc = row.verdict_tsc === 'edge';
  const vDc = row.verdict_depcruise === 'edge';
  const vApg = row['verdict_apg-v12e-default'] === 'edge';

  if (row.row_type === 'agreement-sample') {
    const cls = STRATUM_CLASS[row.agreement_stratum ?? ''] ?? 'other';
    if (!(vApg && vTsc && vDc)) return flag('agreement row without three edges');
    if (srcText !== undefined && !(actual ?? '').includes(specifier) && !statementAt(srcText, line).includes(specifier)) return flag(`specifier '${specifier}' not on the cited statement`);
    return { verdict: 'tool-correct', cls, status: 'required', rule: 'R-agree',
      evidence: `${lineCheck} — agreement: '${specifier}' resolves to ${tgt} in all three extractors (stratum ${row.agreement_stratum ?? ''})` };
  }

  const { side, reason } = rowReason(row);
  const outside = [src, tgt].find((p) => p.startsWith('../'));

  if (reason === 'path-alias') {
    if (!(vApg && vTsc && !vDc)) return flag('path-alias row is not APG+tsc vs dependency-cruiser');
    if (specifier.startsWith('.') || !(actual ?? cited).includes(specifier)) return flag('specifier is not a non-relative alias on the line');
    return { verdict: 'tool-correct', cls: 'alias', status: 'required', rule: 'R-alias-depcruise',
      evidence: `${lineCheck} — '${specifier}' is a tsconfig paths alias; tsc resolves it to ${tgt} like the APG; dependency-cruiser does not expand \${configDir} (reference limitation)` };
  }

  if (reason === 'out-of-root') {
    if (outside === undefined) return flag('out-of-root row with both endpoints inside the root');
    return { verdict: 'both-acceptable', cls: 'out-of-root', status: 'acceptable', rule: 'R-out-of-root',
      evidence: `${lineCheck} — ${outside} is outside the extraction root (modelled as a Package node, not a File); by design${vTsc ? '' : '; tsc does not list it because the source is outside the root'}` };
  }

  if (reason === '.d.ts') {
    if (!tgt.endsWith('.d.ts')) return flag('.d.ts row whose target is not a declaration file');
    return { verdict: 'both-acceptable', cls: 'type-only', status: 'acceptable', rule: 'R-dts',
      evidence: `${lineCheck} — '${specifier}' resolves to the declaration file ${tgt}; the extractor excludes **/*.d.ts by default (DEFAULT_EXCLUDE_PATTERNS), so this type-only dependency has no File node${excluded(src) ? `; the source ${src} is itself excluded (${excluded(src) ?? ''})` : ''}` };
  }

  if (reason === 'excluded-file') {
    const ex = [src, tgt].map((p) => ({ p, g: excluded(p) ?? (/\.d\.ts$|\.spec\.ts$|\.test\.ts$/.test(p) ? 'extractor default exclude' : undefined) }));
    const hit = ex.find((x) => x.g !== undefined);
    const nonTs = [src, tgt].find((p) => !/\.tsx?$/.test(p));
    if (hit === undefined && nonTs === undefined && ctx.apgFiles.has(src) && ctx.apgFiles.has(tgt)) return flag('excluded-file row with both endpoints APG files');
    const why = hit !== undefined ? `${hit.p} matches the exclude '${hit.g ?? ''}'`
      : nonTs !== undefined ? `${nonTs} is not a TypeScript source (${nonTs.endsWith('.json') ? 'JSON asset' : 'JavaScript'}), outside the extraction`
        : `${[src, tgt].find((p) => !ctx.apgFiles.has(p)) ?? tgt} is outside the tsconfig/extraction file set`;
    const json = tgt.endsWith('.json');
    return { verdict: 'both-acceptable', cls: json ? 'dynamic' : 'other', status: 'acceptable', rule: json ? 'R-json-require' : 'R-excluded',
      evidence: `${lineCheck} — ${why}; the spec scopes the graph to production TS sources, so the edge is out of scope by design${json ? `; require() of a JSON asset (tsc leaves it unresolved, resolveJsonModule off)` : ''}` };
  }

  if (reason === 're-export/barrel' && side === 'apg') {
    // The code imports the barrel; the v1.2E default drops the module-level edge (BR-U2-24 routing).
    const barrelOut = ctx.edges.filter((e) => e.source === tgt && isReExport(e));
    if (!vTsc || barrelOut.length === 0) return flag(`${tgt} has no re-export edges in the tsc reference`);
    const stmt = srcText !== undefined ? statementAt(srcText, line) : cited;
    const names = importedNames(stmt).filter((n) => n !== '*');
    const tText = ctx.read(tgt);
    const declaredHere = tText === undefined ? [] : names.filter((n) => declaresExport(tText, n));
    if (declaredHere.length > 0) {
      return { verdict: 'reference-correct', cls: 'tool-bug', status: 'required', rule: 'R-barrel-dropped-but-declared',
        evidence: `${lineCheck} — ${tgt} itself declares ${declaredHere.join(', ')}, yet the APG has no edge to it: routing dropped a declaring file` };
    }
    return { verdict: 'reference-correct', cls: 're-export', status: 'required', rule: 'R-barrel-module-edge',
      evidence: `${lineCheck} — '${specifier}' resolves to ${tgt}, a re-export file (${String(barrelOut.length)} re-export edges${tText === undefined ? ', text not in the container' : ''}); the code imports that module, the v1.2E default routes past it (BR-U2-24) and drops the edge; the v1.3 default reExportEdges 'both' emits this literal edge (ADR-V13-01)` };
  }

  if (reason === 're-export/barrel' && side === 'ref') {
    // The APG routed the import to the declaring file; the code imports a barrel that re-exports it.
    const first = ctx.edges.find((e) => e.source === src && e.present.tsc === true && e.specifiers.includes(specifier));
    if (first === undefined) return flag(`no tsc edge from ${src} with specifier '${specifier}'`);
    const chain = reExportChain(first.target, tgt, ctx.edges);
    if (chain === undefined) return { verdict: 'reference-correct', cls: 'tool-bug', status: 'absent', rule: 'R-barrel-routed-no-chain',
      evidence: `${lineCheck} — '${specifier}' resolves to ${first.target}, which does not re-export ${tgt}: routed edge without a re-export path` };
    const stmt = srcText !== undefined ? statementAt(srcText, line) : cited;
    const names = importedNames(stmt);
    const tText = ctx.read(tgt);
    const decl = tText === undefined ? undefined : names.filter((n) => declaresExport(tText, n));
    if (decl?.length === 0) return { verdict: 'reference-correct', cls: 'tool-bug', status: 'absent', rule: 'R-barrel-routed-no-decl',
      evidence: `${lineCheck} — ${tgt} declares none of ${names.join(', ')} imported through ${chain.join(' > ')}` };
    return { verdict: 'both-acceptable', cls: 're-export', status: 'acceptable', rule: 'R-barrel-routed',
      evidence: `${lineCheck} — re-export path ${chain.join(' > ')}; ${decl === undefined ? `${tgt} text not in the container (chain from the tsc re-export edges)` : `${tgt} declares ${decl.join(', ')}`}; a real declaration-level dependency, but the code imports the barrel, not this file` };
  }

  return flag(`unhandled class '${side}:${reason}'`);
}

// ── Proposed (not adjudicated) precision and recall ──────────────────────────

export interface Counts { apgEdges: number; correct: number; required: number; found: number; unadjudicated: number }
export interface Rates extends Counts { precision: number | null; recall: number | null }

export const rates = (c: Counts): Rates => ({
  ...c, precision: c.apgEdges === 0 ? null : c.correct / c.apgEdges, recall: c.required === 0 ? null : c.found / c.required,
});

/**
 * Scores one APG variant over a project's edges. Edges in the APG and in both references are taken as `required`
 * (the agreement samples back this); every other edge takes the status of its sheet row. `strict` also counts the
 * `acceptable` edges the APG holds as wrong (the literal-import reading of the graph).
 */
export function score(
  edges: readonly ProjectEdge[], variant: string, statusOf: (e: ProjectEdge) => EdgeStatus | undefined, strict: boolean, scopedOnly: boolean,
): Counts {
  const c: Counts = { apgEdges: 0, correct: 0, required: 0, found: 0, unadjudicated: 0 };
  for (const e of edges) {
    if (scopedOnly && e.scope !== 'in-scope') continue;
    const inA = e.present[variant] === true;
    const unanimous = inA && e.present.tsc === true && e.present.depcruise === true;
    let st = unanimous ? 'required' as EdgeStatus : statusOf(e);
    if (st === undefined) {
      if (!inA && e.present.tsc !== true && e.present.depcruise !== true) continue; // only in another APG variant
      c.unadjudicated++;
      st = 'required';
    }
    if (inA) { c.apgEdges++; if (st === 'required' || (st === 'acceptable' && !strict)) c.correct++; }
    if (st === 'required') { c.required++; if (inA) c.found++; }
  }
  return c;
}

export const addCounts = (a: Counts, b: Counts): Counts => ({
  apgEdges: a.apgEdges + b.apgEdges, correct: a.correct + b.correct, required: a.required + b.required,
  found: a.found + b.found, unadjudicated: a.unadjudicated + b.unadjudicated,
});

// ── Author review sample ─────────────────────────────────────────────────────

export interface ReviewItem { readonly stratum: string; readonly id: string }

/**
 * Every `tool-bug` and `reference-bug` row, plus a seeded random 10% (rounded up, at least one) of every other class,
 * stratified by class. Deterministic for a seed: items are sorted by id before sampling.
 */
export function reviewSample<T extends ReviewItem>(items: readonly T[], seed: number, fraction = 0.1): { item: T; reason: string }[] {
  const rnd = mulberry32(seed);
  const byClass = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => cmp(a.id, b.id))) byClass.set(it.stratum, [...(byClass.get(it.stratum) ?? []), it]);
  const out: { item: T; reason: string }[] = [];
  for (const cls of [...byClass.keys()].sort(cmp)) {
    const list = byClass.get(cls) ?? [];
    if (cls === 'tool-bug' || cls === 'reference-bug') { for (const item of list) out.push({ item, reason: `all ${cls}` }); continue; }
    const n = Math.max(1, Math.ceil(list.length * fraction));
    const pool = [...list];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = pool[i];
      const other = pool[j];
      if (tmp !== undefined && other !== undefined) { pool[i] = other; pool[j] = tmp; }
    }
    for (const item of pool.slice(0, n).sort((a, b) => cmp(a.id, b.id))) out.push({ item, reason: `random ${String(Math.round(fraction * 100))}% of ${cls} (${String(n)}/${String(list.length)})` });
  }
  return out;
}
