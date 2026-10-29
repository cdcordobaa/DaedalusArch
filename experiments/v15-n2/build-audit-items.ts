/**
 * N2 author audit set (procedure: `experiments/v15-n2/README.md`). Zero model calls, no rule engine.
 *
 *   npx tsx experiments/v15-n2/build-audit-items.ts [--results results/v1.5-traprate-01] [--out experiments/v15-n2/audit-items.json]
 *
 * Rebuilds the TRAPRATE-01 snapshots with `restoreSession` (score-traprate.ts), reads step-03 of every session with
 * ts-morph, finds candidate sites per row by a fixed syntactic filter, draws 10 per row with mulberry32 seed 20261028,
 * and writes the items. Absolute paths never reach the output.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Node, Project, SyntaxKind, type SourceFile, type Type } from 'ts-morph';
import { restoreSession } from '../traprate-01/score-traprate.js';
import { mulberry32 } from '../../scripts/lib/mutation/rng.js';
import { roleOf } from '../../src/v15-instrument/conventions.js';

const SEED = 20261028;
type Row = 'K11' | 'K12' | 'H06';
type Style = 'ddd' | 'hexagonal';
const ROWS: readonly Row[] = ['K11', 'K12', 'H06'];
const STYLES: readonly Style[] = ['ddd', 'hexagonal'];
const CONSTRUCT: Record<Row, string> = {
  K11: "an in-process lock (a set, map, flag or mutex held in a service) standing in for an aggregate's consistency boundary.",
  K12: "a business calculation over an aggregate's or entity's state done in an application service (or adapter) and handed back to it, instead of inside the aggregate/entity.",
  H06: 'an adapter decides a business rule: code in an inbound or outbound adapter that branches on domain state or domain values to accept, reject, price or change something (transport-shape validation is not a business rule).',
};
const MAX_LINES = 40;
const MAX_TYPE_LINES = 10;

interface Numbered { readonly line: number; readonly text: string }
interface Candidate {
  readonly row: Row; readonly style: Style; readonly session: string; readonly file: string;
  readonly unitStart: number; readonly unitEnd: number; readonly siteLines: number[];
  readonly excerpt: Numbered[]; readonly fieldDeclaration?: Numbered[];
  readonly domainType?: { file: string; lines: Numbered[] };
}

const isDomainRole = (rel: string): boolean => { const r = roleOf(rel, 'hexddd'); return r === 'domain' || r === 'shared-kernel'; };

function makeCtx(root: string) {
  const rel = (sf: SourceFile): string => path.relative(root, sf.getFilePath()).split(path.sep).join('/');
  /** The domain-type declaration of a type, if any (README: class, interface or object-literal alias in a domain file; not a repository port). */
  const domainDecl = (t: Type): Node | undefined => {
    const parts = t.isUnion() ? t.getUnionTypes() : [t];
    for (const p0 of parts) {
      if (p0.isNull() || p0.isUndefined()) continue;
      const p = p0.isArray() ? undefined : p0; // an array is not itself a domain value
      if (p === undefined) continue;
      for (const sym of [p.getSymbol(), p.getAliasSymbol()]) {
        if (sym === undefined) continue;
        if (/Repository$/.test(sym.getName())) continue;
        for (const d of sym.getDeclarations()) {
          const ok = Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)
            || (Node.isTypeAliasDeclaration(d) && Node.isTypeLiteral(d.getTypeNode()));
          if (ok && isDomainRole(rel(d.getSourceFile()))) return d;
        }
      }
    }
    return undefined;
  };
  /** The first property access in `n`'s subtree (including `n`) whose receiver is domain-typed. */
  const domainAccess = (n: Node): Node | undefined => {
    const all = [n, ...n.getDescendants()];
    for (const x of all) {
      if (!Node.isPropertyAccessExpression(x)) continue;
      const d = domainDecl(x.getExpression().getType());
      if (d !== undefined) return d;
    }
    return undefined;
  };
  return { rel, domainDecl, domainAccess };
}

/** README "Unit": nearest enclosing class member or top-level function / variable statement. */
function unitOf(n: Node): Node | undefined {
  let cur: Node | undefined = n;
  let found: Node | undefined;
  while (cur !== undefined) {
    if (Node.isMethodDeclaration(cur) || Node.isConstructorDeclaration(cur) || Node.isGetAccessorDeclaration(cur)
      || Node.isSetAccessorDeclaration(cur) || (Node.isPropertyDeclaration(cur) && cur.getInitializer() !== undefined)) {
      if (Node.isClassDeclaration(cur.getParent()) || Node.isClassExpression(cur.getParent())) return cur;
    }
    if ((Node.isFunctionDeclaration(cur) || Node.isVariableStatement(cur)) && Node.isSourceFile(cur.getParent())) found = cur;
    if (found !== undefined) return found;
    cur = cur.getParent();
  }
  return undefined;
}

const numbered = (lines: readonly string[], from: number, to: number): Numbered[] => {
  const out: Numbered[] = [];
  for (let l = from; l <= to; l++) out.push({ line: l, text: lines[l - 1] ?? '' });
  return out;
};
function excerptOf(lines: readonly string[], start: number, end: number, sites: readonly number[]): Numbered[] {
  if (end - start + 1 <= MAX_LINES) return numbered(lines, start, end);
  const lo = Math.min(...sites);
  const hi = Math.max(...sites);
  const mid = Math.floor((lo + hi) / 2);
  let a = Math.max(start, mid - Math.floor(MAX_LINES / 2));
  const b = Math.min(end, a + MAX_LINES - 1);
  a = Math.max(start, b - MAX_LINES + 1);
  return numbered(lines, a, b);
}
function typeExcerpt(d: Node, rel: (sf: SourceFile) => string): { file: string; lines: Numbered[] } {
  const lines = d.getSourceFile().getFullText().split('\n');
  const s = d.getStartLineNumber();
  return { file: rel(d.getSourceFile()), lines: numbered(lines, s, Math.min(d.getEndLineNumber(), s + MAX_TYPE_LINES - 1)) };
}

const ARITH_BIN = new Set([SyntaxKind.PlusToken, SyntaxKind.MinusToken, SyntaxKind.AsteriskToken, SyntaxKind.SlashToken,
  SyntaxKind.PlusEqualsToken, SyntaxKind.MinusEqualsToken, SyntaxKind.AsteriskEqualsToken, SyntaxKind.SlashEqualsToken]);
const isArith = (n: Node): boolean => {
  if (Node.isBinaryExpression(n)) return ARITH_BIN.has(n.getOperatorToken().getKind());
  if (Node.isCallExpression(n)) { const e = n.getExpression(); return Node.isPropertyAccessExpression(e) && e.getExpression().getText() === 'Math'; }
  return false;
};
const LOCK_TYPE = (t: Type, text: string): boolean => {
  if (t.isBoolean() || t.isBooleanLiteral()) return true;
  const name = t.getSymbol()?.getName() ?? t.getAliasSymbol()?.getName() ?? '';
  if (['Set', 'Map', 'WeakSet', 'WeakMap', 'ReadonlySet', 'ReadonlyMap'].includes(name)) return true;
  return /mutex|lock|semaphore/i.test(name) || /mutex|lock|semaphore/i.test(text);
};

function scanSession(session: string, style: Style, root: string): { sites: Record<Row, number>; cands: Candidate[] } {
  const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { target: 9, module: 99, moduleResolution: 100, strict: true, skipLibCheck: true, noEmit: true } });
  project.addSourceFilesAtPaths([path.join(root, 'src/**/*.ts')]);
  const { rel, domainAccess } = makeCtx(root);
  const sites: Record<Row, number> = { K11: 0, K12: 0, H06: 0 };
  const byUnit = new Map<string, { row: Row; file: string; unit: Node; sites: number[]; type?: Node; field?: Node; lines: string[] }>();
  const hit = (row: Row, sf: SourceFile, unit: Node | undefined, line: number, type?: Node, field?: Node): void => {
    if (unit === undefined) return;
    sites[row]++;
    const k = `${row}|${rel(sf)}|${String(unit.getStartLineNumber())}`;
    const e = byUnit.get(k);
    if (e === undefined) byUnit.set(k, { row, file: rel(sf), unit, sites: [line], type, field, lines: sf.getFullText().split('\n') });
    else { e.sites.push(line); if (e.type === undefined) e.type = type; }
  };
  for (const sf of project.getSourceFiles()) {
    const file = rel(sf);
    if (file.endsWith('.d.ts')) continue;
    const role = roleOf(file, 'hexddd');
    const appOrAdapter = role === 'application' || role === 'adapter';
    if (appOrAdapter) {
      // K12
      sf.forEachDescendant((n) => {
        if (!isArith(n)) return;
        const p = n.getParent();
        if (p !== undefined && isArith(p)) return;
        if (Node.isParenthesizedExpression(p) && p.getParent() !== undefined && isArith(p.getParentOrThrow())) return;
        if (n.getType().isString() || n.getType().isStringLiteral()) return;
        const d = domainAccess(n);
        if (d !== undefined) hit('K12', sf, unitOf(n), n.getStartLineNumber(), d);
      });
      // K11: class fields and module-level variables of a lock-like type
      const holders: { decl: Node; name: string; isField: boolean }[] = [];
      for (const c of sf.getClasses()) for (const pr of c.getProperties()) if (LOCK_TYPE(pr.getType(), pr.getTypeNode()?.getText() ?? '')) holders.push({ decl: pr, name: pr.getName(), isField: true });
      for (const vs of sf.getVariableStatements()) for (const vd of vs.getDeclarations()) if (LOCK_TYPE(vd.getType(), vd.getTypeNode()?.getText() ?? '')) holders.push({ decl: vs, name: vd.getName(), isField: false });
      const units = [...sf.getClasses().flatMap((c) => c.getMembers()), ...sf.getFunctions(), ...sf.getVariableStatements()];
      for (const u of units) {
        const callsSave = u.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => { const e = c.getExpression(); return Node.isPropertyAccessExpression(e) && ['save', 'saveAll'].includes(e.getName()); });
        if (!callsSave) continue;
        for (const h of holders) {
          if (h.decl === u) continue;
          const refs = h.isField
            ? u.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).filter((p) => p.getName() === h.name && p.getExpression().getKind() === SyntaxKind.ThisKeyword)
            : u.getDescendantsOfKind(SyntaxKind.Identifier).filter((i) => { const p = i.getParent(); return i.getText() === h.name && !(Node.isPropertyAccessExpression(p) && p.getNameNode() === i) && !(Node.isVariableDeclaration(p) && p.getNameNode() === i) && !Node.isPropertyAssignment(p); });
          let read = false; let write = false; const lines: number[] = [];
          for (const r of refs) {
            const p = r.getParent();
            const isAssign = Node.isBinaryExpression(p) && p.getLeft() === r && p.getOperatorToken().getKind() >= SyntaxKind.FirstAssignment && p.getOperatorToken().getKind() <= SyntaxKind.LastAssignment;
            const isIncDec = (Node.isPrefixUnaryExpression(p) || Node.isPostfixUnaryExpression(p)) && [SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(p.getOperatorToken());
            const isMut = Node.isPropertyAccessExpression(p) && p.getExpression() === r && ['add', 'set', 'delete', 'clear'].includes(p.getName()) && Node.isCallExpression(p.getParent());
            if (isAssign || isIncDec || isMut) write = true; else read = true;
            lines.push(r.getStartLineNumber());
          }
          if (read && write) for (const l of lines) hit('K11', sf, u, l, undefined, h.decl);
        }
      }
    }
    if (role === 'adapter') {
      // H06
      sf.forEachDescendant((n) => {
        let cond: Node | undefined;
        if (Node.isIfStatement(n)) cond = n.getExpression();
        else if (Node.isConditionalExpression(n)) cond = n.getCondition();
        else if (Node.isSwitchStatement(n)) cond = n.getExpression();
        if (cond === undefined) return;
        const d = domainAccess(cond);
        if (d !== undefined) hit('H06', sf, unitOf(n), n.getStartLineNumber(), d);
      });
    }
  }
  const cands: Candidate[] = [];
  for (const e of byUnit.values()) {
    const s = e.unit.getStartLineNumber();
    const t = e.unit.getEndLineNumber();
    const fieldDeclaration = e.field === undefined ? undefined : numbered(e.lines, e.field.getStartLineNumber(), Math.min(e.field.getEndLineNumber(), e.field.getStartLineNumber() + MAX_TYPE_LINES - 1));
    cands.push({
      row: e.row, style, session, file: e.file, unitStart: s, unitEnd: t, siteLines: [...new Set(e.sites)].sort((a, b) => a - b),
      excerpt: excerptOf(e.lines, s, t, e.sites),
      ...(fieldDeclaration === undefined ? {} : { fieldDeclaration }),
      ...(e.type === undefined ? {} : { domainType: typeExcerpt(e.type, rel) }),
    });
  }
  return { sites, cands };
}

function main(): void {
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const REPO = process.cwd();
  const results = path.resolve(arg('results') ?? 'results/v1.5-traprate-01');
  const outFile = path.resolve(arg('out') ?? 'experiments/v15-n2/audit-items.json');
  const input = JSON.parse(fs.readFileSync(path.join(results, 'run', 'input.json'), 'utf8')) as { tasks: { id: string; seedTreeSha256: string }[] };
  const map = JSON.parse(fs.readFileSync(path.join(results, 'private-id-map.json'), 'utf8')) as Record<string, { task: string; style: Style }>;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'n2-audit-'));
  const all: Candidate[] = [];
  const siteCounts: Record<Row, Record<Style, number>> = { K11: { ddd: 0, hexagonal: 0 }, K12: { ddd: 0, hexagonal: 0 }, H06: { ddd: 0, hexagonal: 0 } };
  let verified = 0;
  const ids = fs.readdirSync(path.join(results, 'sessions')).filter((d) => fs.existsSync(path.join(results, 'sessions', d, 'session.json'))).sort();
  try {
    for (const id of ids) {
      const t = (JSON.parse(fs.readFileSync(path.join(results, 'sessions', id, 'session.json'), 'utf8')) as { taskId: string }).taskId;
      const m = map[t];
      const pin = input.tasks.find((x) => x.id === t)?.seedTreeSha256;
      if (m === undefined || pin === undefined) throw new Error(`no map entry or seed pin for ${t}`);
      const rep = restoreSession(results, id, path.join(REPO, 'experiments/trap-families', m.task, 'seed'), pin, scratch);
      verified += rep.verified.filter(Boolean).length;
      const root = path.join(scratch, id, 'snap', 'step-03');
      const { sites, cands } = scanSession(id, m.style, root);
      for (const r of ROWS) siteCounts[r][m.style] += sites[r];
      all.push(...cands);
      fs.rmSync(path.join(scratch, id), { recursive: true, force: true });
      process.stdout.write(`${id} ${m.style}: K11 ${String(sites.K11)} K12 ${String(sites.K12)} H06 ${String(sites.H06)}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  all.sort((a, b) => a.session.localeCompare(b.session) || a.file.localeCompare(b.file) || a.unitStart - b.unitStart || a.row.localeCompare(b.row));
  const candCounts: Record<Row, Record<Style, number>> = { K11: { ddd: 0, hexagonal: 0 }, K12: { ddd: 0, hexagonal: 0 }, H06: { ddd: 0, hexagonal: 0 } };
  for (const c of all) candCounts[c.row][c.style]++;

  // Draw (README §2)
  const rng = mulberry32(SEED);
  const orders = new Map<string, Candidate[]>();
  for (const r of ROWS) for (const s of STYLES) { const xs = all.filter((c) => c.row === r && c.style === s); orders.set(`${r}|${s}`, [...rng.pickDistinct(xs, xs.length)]); }
  const cursor = new Map<string, number>([...orders.keys()].map((k) => [k, 0]));
  const perSession = new Map<string, number>();
  const seenExcerpt = new Set<string>();
  const drawn: Candidate[] = [];
  const keyOf = (c: Candidate): string => c.excerpt.map((l) => l.text).join('\n');
  const takeNext = (k: string): Candidate | undefined => {
    const xs = orders.get(k) as Candidate[];
    let i = cursor.get(k) as number;
    while (i < xs.length) {
      const c = xs[i] as Candidate; i++;
      if ((perSession.get(c.session) ?? 0) >= 2 || seenExcerpt.has(keyOf(c))) continue;
      cursor.set(k, i);
      perSession.set(c.session, (perSession.get(c.session) ?? 0) + 1); seenExcerpt.add(keyOf(c)); drawn.push(c);
      return c;
    }
    cursor.set(k, i);
    return undefined;
  };
  const perRow: Record<Row, Record<Style, number>> = { K11: { ddd: 0, hexagonal: 0 }, K12: { ddd: 0, hexagonal: 0 }, H06: { ddd: 0, hexagonal: 0 } };
  const styleFill: { row: Row; from: Style; n: number }[] = [];
  for (const r of ROWS) {
    for (const s of STYLES) for (let j = 0; j < 5; j++) { if (takeNext(`${r}|${s}`) === undefined) break; perRow[r][s]++; }
    for (const s of STYLES) {
      while (perRow[r].ddd + perRow[r].hexagonal < 10) {
        if (takeNext(`${r}|${s}`) === undefined) break;
        perRow[r][s]++;
        const f = styleFill.find((x) => x.row === r && x.from === s);
        if (f === undefined) styleFill.push({ row: r, from: s, n: 1 }); else f.n++;
      }
    }
  }
  const rowFill: { shortRow: Row; short: number; filledFrom: Partial<Record<Row, number>> }[] = [];
  for (const r of ROWS) {
    const got = perRow[r].ddd + perRow[r].hexagonal;
    if (got >= 10) continue;
    const need = 10 - got;
    const rec = { shortRow: r, short: need, filledFrom: {} as Partial<Record<Row, number>> };
    let left = need;
    for (const o of ROWS) {
      if (o === r) continue;
      for (const s of STYLES) {
        while (left > 0 && takeNext(`${o}|${s}`) !== undefined) { perRow[o][s]++; rec.filledFrom[o] = (rec.filledFrom[o] ?? 0) + 1; left--; }
      }
    }
    rowFill.push(rec);
  }
  const left = all.filter((c) => !drawn.includes(c));
  const skipped = { identicalExcerpt: left.filter((c) => seenExcerpt.has(keyOf(c))).length, sessionCap: left.filter((c) => !seenExcerpt.has(keyOf(c))).length };
  const shuffled = rng.pickDistinct(drawn, drawn.length);
  const items = shuffled.map((c, i) => ({
    id: `A${String(i + 1).padStart(2, '0')}`, row: c.row, question: `Does this code contain: ${CONSTRUCT[c.row]}?`,
    session: c.session, file: c.file, excerpt: c.excerpt,
    ...(c.fieldDeclaration === undefined ? {} : { fieldDeclaration: c.fieldDeclaration }),
    ...(c.domainType === undefined ? {} : { domainType: c.domainType }),
  }));
  const itemsPerRow: Record<Row, Record<Style, number>> = perRow;
  const out = {
    schema: 'v15-n2-audit-items/v1', modelCalls: 0,
    procedure: 'experiments/v15-n2/README.md (committed before drawing); script experiments/v15-n2/build-audit-items.ts',
    source: { results: 'results/v1.5-traprate-01', step: 'step-03', sessions: ids.length, treesVerified: verified, rebuiltWith: 'restoreSession of experiments/traprate-01/score-traprate.ts' },
    seed: SEED,
    counts: { sites: siteCounts, candidates: candCounts, itemsPerRowStyle: itemsPerRow, items: items.length, undrawnCandidates: skipped, styleFill, fill: rowFill },
    items,
  };
  fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1).split(scratch).join('<scratch>').split(REPO).join('.')}\n`);
  process.stdout.write(`${JSON.stringify(out.counts)}\n`);
}

main();
