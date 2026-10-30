/**
 * v1.5 R-MIRROR2 (row H11 v2, exploratory, 2026-10-29): the vendor lexicon and the core terms it is matched against.
 * Zero model calls. This module only extracts and tokenises; the matching (which core term mirrors which vendor term,
 * the field-set test) is the Cypher text of `rules/r-mirror2-vendor-lexicon.cypher`.
 *
 * Vendor lexicon: the exports of every vendor module an adapter of the tree imports (the vendor modules of R-MIRROR,
 * found by `facts.ts`): declaration names, string-literal values (with the value set each belongs to), enum members,
 * field names and method names, nested object types included.
 *
 * Core terms: in domain, application and port files, every string literal (with where it sits: a comparison, a switch
 * case, an includes/has/indexOf argument, a union member, an enum value, a constant set, an error, other) and every
 * declared field or method name (interfaces, type literals, classes, constructor parameter properties).
 *
 * Tokens: a literal's token is its exact text (`lit:DECLINED`, case kept: `'declined'` is not `'DECLINED'`); a name's
 * token is its lower-cased word sequence without separators (`name:amountminor` for `amountMinor`, `amount_minor`,
 * `AMOUNT_MINOR`), so a renamed casing of a vendor field meets the field. A vendor declaration name is also a literal
 * token, so a core string naming it (`e.name === 'RatewiseUnavailableError'`) meets it.
 *
 * Stoplist (`ownedBy`, decided here, filtered in Cypher): a vendor term is not counted as the vendor's own vocabulary when
 *   - `generic`: it is shared language, not the vendor's coinage:
 *       a literal of at most 2 characters ('O', 'AB', 'CC'), or a single lower-case word ('pending', 'automatic',
 *       'routine'): a vendor code is written as a code (UPPER_CASE, snake_case, dotted, kebab, with digits) or is a
 *       multi-word value; a single lower-case word is ordinary language a core may choose for itself;
 *       a name made of one word ('quality', 'status', 'precision', 'symbol'), or a compound in GENERIC_NAMES
 *       (createdAt, apiKey, firstName, ...): one-word field names are the ordinary vocabulary of the domain;
 *       a method name of one word ('charge', 'route', 'latest');
 *   - `spec`: its token is a word or a two-word phrase of the tree's own spec file (the project names it itself);
 *   - `baseline`: its token occurs in the core of a baseline tree (`BuildOptions.baseline`, for example the task's
 *     seed): the core already owned the term before the change, so only NEW mirrored vocabulary is reported.
 * The field-set shape (a core type all of whose >= 3 non-id field names are fields of one vendor declaration, R-MIRROR's
 * names shape) ignores `generic`: there the evidence is the whole set, not one word. The single-field shape needs the
 * exact vendor spelling (`treatment_code` in the vendor, `treatmentCode` in the core is a translation, not a copy).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { SourceFile, Type } from 'ts-morph';
import type { Role } from './spec.js';

export type VendorTermKind = 'decl' | 'literal' | 'field' | 'method' | 'member';
export interface VendorTermFact {
  readonly module: string; readonly decl: string; readonly kind: VendorTermKind; readonly text: string; readonly token: string;
  /** For a literal: the value set it belongs to (`HlPriority`, `RatewiseRate.quality`) and that set's size. */
  readonly set: string; readonly setSize: number;
  readonly isError: boolean;
  /** '' when the term counts as the vendor's own; else why not: 'generic', 'spec' or 'baseline'. */
  readonly ownedBy: '' | 'generic' | 'spec' | 'baseline';
}
export type CoreContext = 'compare' | 'switch' | 'includes' | 'union' | 'enum' | 'const-set' | 'error' | 'value' | 'other' | 'field' | 'method';
export interface CoreTermFact {
  readonly file: string; readonly line: number; readonly role: Role; readonly kind: 'literal' | 'field' | 'method';
  readonly text: string; readonly token: string;
  /** The enclosing named declaration (`Class.method`, `Interface.field`, `TypeAlias`, a const, a function). */
  readonly symbol: string;
  readonly context: CoreContext;
  /** For a literal that is a member of a declared value set (union, enum, const array/Set/object values): the set and its size. */
  readonly set: string; readonly setSize: number;
  /** For a field: its owner type and the number of the owner's non-id field names. */
  readonly owner: string; readonly ownerFields: number;
}

/** Words of a name or literal: camelCase, PascalCase, snake, kebab, dotted and digits split; lower case. */
export function words(s: string): string[] {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
}
export const nameToken = (s: string): string => `name:${words(s).join('')}`;
export const literalToken = (s: string): string => `lit:${s}`;

/** Compound names that are ordinary data-model vocabulary, not a vendor's coinage. */
export const GENERIC_NAMES: ReadonlySet<string> = new Set([
  'apikey', 'createdat', 'updatedat', 'deletedat', 'firstname', 'lastname', 'fullname', 'emailaddress', 'phonenumber',
  'startdate', 'enddate', 'starttime', 'endtime', 'startsat', 'endsat', 'expiresat', 'occurredat', 'userid', 'customerid',
  'orderid', 'errorcode', 'errormessage', 'statuscode', 'pagesize', 'nextpage', 'totalcount', 'requestid',
]);

export function genericVendorTerm(kind: VendorTermKind, text: string): boolean {
  if (kind === 'literal') return text.length <= 2 || /^[a-z]+$/.test(text);
  if (kind === 'decl') return false;
  const w = words(text);
  return w.length <= 1 || GENERIC_NAMES.has(w.join(''));
}

/** Tokens of a spec file: every word and every two-word phrase, as name tokens; every quoted or bare value as a literal token. */
export function specTokens(specFile: string | undefined): Set<string> {
  const out = new Set<string>();
  if (specFile === undefined || !fs.existsSync(specFile)) return out;
  const text = fs.readFileSync(specFile, 'utf8');
  const ws = text.split(/[^A-Za-z0-9_.-]+/).filter(Boolean);
  for (let i = 0; i < ws.length; i++) {
    out.add(literalToken(ws[i]!));
    out.add(nameToken(ws[i]!));
    if (i + 1 < ws.length) out.add(`name:${[...words(ws[i]!), ...words(ws[i + 1]!)].join('')}`);
  }
  return out;
}

const EXCLUDED_PARENT = (n: Node): boolean => {
  const p = n.getParent();
  return p === undefined || Node.isImportDeclaration(p) || Node.isExportDeclaration(p) || Node.isModuleDeclaration(p) || Node.isExternalModuleReference(p)
    || Node.isImportTypeNode(p) || (Node.isLiteralTypeNode(p) && Node.isImportTypeNode(p.getParent() ?? p));
};

const isErrorClass = (n: Node): boolean => {
  if (!Node.isClassDeclaration(n)) return false;
  if (/(Error|Exception)$/.test(n.getName() ?? '')) return true;
  const ext = n.getExtends()?.getExpression().getText() ?? '';
  return /(Error|Exception)$/.test(ext);
};

/** The enclosing named declaration of a node. */
export function symbolOf(n: Node): string {
  const parts: string[] = [];
  for (let a: Node | undefined = n.getParent(); a !== undefined && !Node.isSourceFile(a); a = a.getParent()) {
    if (Node.isMethodDeclaration(a) || Node.isMethodSignature(a) || Node.isPropertyDeclaration(a) || Node.isPropertySignature(a) || Node.isGetAccessorDeclaration(a) || Node.isSetAccessorDeclaration(a)) parts.unshift(a.getName());
    else if (Node.isConstructorDeclaration(a)) parts.unshift('constructor');
    else if (Node.isClassDeclaration(a) || Node.isInterfaceDeclaration(a) || Node.isTypeAliasDeclaration(a) || Node.isEnumDeclaration(a) || Node.isFunctionDeclaration(a)) { parts.unshift(a.getName() ?? 'anonymous'); break; }
    else if (Node.isVariableDeclaration(a)) {
      const st = a.getVariableStatement()?.getParent();
      if (st !== undefined && Node.isSourceFile(st)) { parts.unshift(a.getName()); break; }
    }
  }
  return parts.join('.') || '(module)';
}

const COMPARE_OPS = new Set([SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.ExclamationEqualsEqualsToken, SyntaxKind.EqualsEqualsToken, SyntaxKind.ExclamationEqualsToken]);
const INCLUDES = /^(includes|has|indexOf|startsWith|endsWith|lastIndexOf)$/;

export function literalContext(lit: Node): CoreContext {
  for (let a: Node | undefined = lit.getParent(); a !== undefined && !Node.isSourceFile(a); a = a.getParent()) {
    if (Node.isThrowStatement(a)) return 'error';
    if (Node.isClassDeclaration(a)) { if (isErrorClass(a)) return 'error'; break; }
    if (Node.isNewExpression(a) && /(Error|Exception)$/.test(a.getExpression().getText())) return 'error';
  }
  const p = lit.getParentOrThrow();
  if (Node.isLiteralTypeNode(p)) return 'union';
  if (Node.isEnumMember(p)) return 'enum';
  if (Node.isBinaryExpression(p) && COMPARE_OPS.has(p.getOperatorToken().getKind())) return 'compare';
  if (Node.isCaseClause(p)) return 'switch';
  if (Node.isCallExpression(p)) {
    const ex = p.getExpression();
    if (Node.isPropertyAccessExpression(ex) && INCLUDES.test(ex.getName())) return 'includes';
  }
  if (Node.isArrayLiteralExpression(p)) {
    const pp = p.getParent();
    if (pp !== undefined && Node.isPropertyAccessExpression(pp) && INCLUDES.test(pp.getName())) return 'includes';
    return 'const-set';
  }
  if (Node.isPropertyAssignment(p) || Node.isReturnStatement(p)) return 'value';
  return 'other';
}

/** The vendor lexicon of one vendor module's exported declarations. */
export function vendorTermsOf(mod: string, exportsOf: readonly { name: string; decls: readonly Node[] }[]): Omit<VendorTermFact, 'ownedBy'>[] {
  const out: Omit<VendorTermFact, 'ownedBy'>[] = [];
  const add = (decl: string, kind: VendorTermKind, text: string, isError: boolean, set = '', setSize = 0): void => {
    out.push({ module: mod, decl, kind, text, token: kind === 'literal' || kind === 'decl' ? literalToken(text) : nameToken(text), set, setSize, isError });
  };
  const literalsOf = (t: Type): string[] | undefined => {
    const parts = (t.isUnion() ? t.getUnionTypes() : [t]).filter((p) => !p.isUndefined() && !p.isNull());
    const lits = parts.filter((p) => p.isStringLiteral()).map((p) => String(p.getLiteralValue()));
    return lits.length > 0 ? lits : undefined;
  };
  const walkType = (decl: string, setId: string, t: Type, isError: boolean, depth: number, seen: Set<Type>): void => {
    if (depth > 3 || seen.has(t)) return;
    seen.add(t);
    const el = t.isArray() ? t.getArrayElementType() : undefined;
    if (el !== undefined) { walkType(decl, setId, el, isError, depth, seen); return; }
    const lits = literalsOf(t);
    if (lits !== undefined) {
      const sid = t.getAliasSymbol()?.getName() ?? setId;
      for (const l of lits) add(decl, 'literal', l, isError, sid, lits.length);
      return;
    }
    if (t.isUnion()) { for (const u of t.getUnionTypes()) walkType(decl, setId, u, isError, depth + 1, seen); return; }
    if (!t.isObject() || t.getCallSignatures().length > 0) return;
    // a named vendor type other than the one being walked is walked from its own export
    for (const p of t.getProperties()) {
      const vd = p.getValueDeclaration() ?? p.getDeclarations()[0];
      if (vd === undefined) continue;
      const pt = vd.getType();
      if (Node.isMethodDeclaration(vd) || Node.isMethodSignature(vd) || pt.getCallSignatures().length > 0) {
        add(decl, 'method', p.getName(), isError);
        for (const sig of pt.getCallSignatures()) for (const prm of sig.getParameters()) { const pd = prm.getValueDeclaration(); if (pd !== undefined) walkType(decl, `${setId}.${p.getName()}`, pd.getType(), isError, depth + 1, seen); }
        continue;
      }
      add(decl, 'field', p.getName(), isError);
      walkType(decl, `${setId}.${p.getName()}`, pt, isError, depth + 1, seen);
    }
  };
  for (const ex of exportsOf) {
    for (const d of ex.decls) {
      if (Node.isEnumDeclaration(d)) {
        add(ex.name, 'decl', ex.name, false);
        const vals = d.getMembers().map((m) => m.getValue()).filter((v): v is string => typeof v === 'string');
        for (const m of d.getMembers()) {
          add(ex.name, 'member', m.getName(), false);
          const v = m.getValue();
          if (typeof v === 'string') add(ex.name, 'literal', v, false, ex.name, vals.length);
        }
      } else if (Node.isInterfaceDeclaration(d) || Node.isClassDeclaration(d) || Node.isTypeAliasDeclaration(d)) {
        let err = false;
        if (Node.isClassDeclaration(d)) {
          for (let c: import('ts-morph').ClassDeclaration | undefined = d; c !== undefined; c = c.getBaseClass()) if (isErrorClass(c)) { err = true; break; }
          for (const ctor of d.getConstructors()) for (const prm of ctor.getParameters()) walkType(ex.name, `${ex.name}.constructor`, prm.getType(), err, 1, new Set());
          for (const m of d.getMethods()) {
            add(ex.name, 'method', m.getName(), err);
            for (const prm of m.getParameters()) walkType(ex.name, `${ex.name}.${m.getName()}`, prm.getType(), err, 1, new Set());
          }
        }
        add(ex.name, 'decl', ex.name, err);
        walkType(ex.name, ex.name, d.getType(), err, 0, new Set());
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((t) => { const k = `${t.decl}|${t.kind}|${t.text}|${t.set}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const unwrap = (e: Node): Node => { let x = e; while (Node.isAsExpression(x) || Node.isSatisfiesExpression(x) || Node.isParenthesizedExpression(x) || Node.isTypeAssertion(x)) x = x.getExpression(); return x; };
const strOf = (n: Node | undefined): string | undefined => (n !== undefined && (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n)) ? n.getLiteralValue() : undefined);

/** The declared value sets of a core file: string-literal unions, enums, const arrays / Sets / object values. */
function valueSetsOf(sf: SourceFile): Map<Node, { set: string; size: number }> {
  const sets = new Map<Node, { set: string; size: number }>();
  const mark = (lits: Node[], set: string): void => { if (lits.length >= 2) for (const l of lits) sets.set(l, { set, size: lits.length }); };
  for (const u of sf.getDescendantsOfKind(SyntaxKind.UnionType)) {
    if (u.getParent() !== undefined && Node.isUnionTypeNode(u.getParent()!)) continue;
    const lits = u.getTypeNodes().filter((t) => Node.isLiteralTypeNode(t) && Node.isStringLiteral(t.getLiteral())).map((t) => (t as import('ts-morph').LiteralTypeNode).getLiteral());
    const host = u.getFirstAncestor((a) => Node.isTypeAliasDeclaration(a) || Node.isPropertySignature(a) || Node.isPropertyDeclaration(a) || Node.isParameterDeclaration(a));
    const name = host !== undefined && (Node.isTypeAliasDeclaration(host) || Node.isPropertySignature(host) || Node.isPropertyDeclaration(host) || Node.isParameterDeclaration(host)) ? host.getName() : 'union';
    mark(lits, `${symbolOf(u)}${Node.isTypeAliasDeclaration(host ?? u) ? '' : `.${name}`}`.replace(/^\(module\)\./, ''));
  }
  for (const en of sf.getEnums()) mark(en.getMembers().map((m) => m.getInitializer()).filter((i): i is NonNullable<typeof i> => i !== undefined && Node.isStringLiteral(i)), en.getName());
  for (const vd of sf.getVariableDeclarations()) {
    if (vd.getVariableStatement()?.getDeclarationKind() !== 'const') continue;
    const init = vd.getInitializer();
    if (init === undefined) continue;
    let e = unwrap(init);
    if (Node.isNewExpression(e) && /^(Set|ReadonlySet)$/.test(e.getExpression().getText())) { const a = e.getArguments()[0]; if (a !== undefined) e = unwrap(a); }
    if (Node.isArrayLiteralExpression(e)) mark(e.getElements().map(unwrap).filter((x) => strOf(x) !== undefined), vd.getName());
    else if (Node.isObjectLiteralExpression(e)) mark(e.getProperties().map((p) => (Node.isPropertyAssignment(p) ? unwrap(p.getInitializerOrThrow()) : p)).filter((x) => strOf(x) !== undefined), vd.getName());
  }
  return sets;
}

/** The core terms of one domain, application or port file. */
export function coreTermsOf(sf: SourceFile, file: string, role: Role): CoreTermFact[] {
  const out: CoreTermFact[] = [];
  const sets = valueSetsOf(sf);
  for (const lit of [...sf.getDescendantsOfKind(SyntaxKind.StringLiteral), ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)]) {
    if (EXCLUDED_PARENT(lit)) continue;
    const text = lit.getLiteralValue();
    if (text === '') continue;
    const s = sets.get(lit);
    out.push({ file, line: lit.getStartLineNumber(), role, kind: 'literal', text, token: literalToken(text), symbol: symbolOf(lit), context: literalContext(lit), set: s?.set ?? '', setSize: s?.size ?? 0, owner: '', ownerFields: 0 });
  }
  const fieldOwner = (n: Node): { owner: string; fields: number } => {
    const o = n.getParent();
    if (o === undefined) return { owner: '', fields: 0 };
    const host = Node.isTypeLiteral(o) ? o.getFirstAncestor((a) => Node.isTypeAliasDeclaration(a) || Node.isPropertySignature(a) || Node.isVariableDeclaration(a)) : o;
    const owner = host !== undefined && (Node.isInterfaceDeclaration(host) || Node.isClassDeclaration(host) || Node.isTypeAliasDeclaration(host) || Node.isPropertySignature(host) || Node.isVariableDeclaration(host)) ? (host.getName() ?? 'anonymous') : symbolOf(n);
    const members = Node.isInterfaceDeclaration(o) || Node.isTypeLiteral(o) ? o.getProperties().map((p) => p.getName())
      : Node.isClassDeclaration(o) ? [...o.getProperties().map((p) => p.getName()), ...o.getConstructors().flatMap((c) => c.getParameters().filter((p) => p.isParameterProperty()).map((p) => p.getName()))]
        : Node.isConstructorDeclaration(o) ? o.getParameters().filter((p) => p.isParameterProperty()).map((p) => p.getName()) : [];
    return { owner, fields: members.filter((m) => m !== 'id').length };
  };
  const addName = (n: Node, name: string, kind: 'field' | 'method'): void => {
    const o = fieldOwner(n);
    out.push({ file, line: n.getStartLineNumber(), role, kind, text: name, token: nameToken(name), symbol: `${symbolOf(n) === '(module)' ? o.owner : symbolOf(n)}.${name}`.replace(/^\./, ''), context: kind, set: '', setSize: 0, owner: o.owner, ownerFields: o.fields });
  };
  for (const p of sf.getDescendantsOfKind(SyntaxKind.PropertySignature)) addName(p, p.getName().replace(/^['"]|['"]$/g, ''), 'field');
  for (const p of sf.getDescendantsOfKind(SyntaxKind.PropertyDeclaration)) addName(p, p.getName(), 'field');
  for (const p of sf.getDescendantsOfKind(SyntaxKind.Parameter)) if (p.isParameterProperty()) addName(p, p.getName(), 'field');
  for (const m of [...sf.getDescendantsOfKind(SyntaxKind.MethodSignature), ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration)]) addName(m, m.getName(), 'method');
  return out;
}

/** The literal and name tokens of a baseline tree's core (for the `baseline` stoplist). Files are parsed, not type-checked. */
export function baselineTokens(baseline: string, roleOf: (file: string) => Role): Set<string> {
  const out = new Set<string>();
  const root = path.resolve(baseline);
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true, compilerOptions: { noEmit: true } });
  const walk = (d: string): void => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) project.addSourceFileAtPath(p);
    }
  };
  walk(path.join(root, 'src'));
  for (const sf of project.getSourceFiles()) {
    const f = path.relative(root, sf.getFilePath()).split(path.sep).join('/');
    const role = roleOf(f);
    if (role !== 'domain' && role !== 'application' && role !== 'port') continue;
    for (const t of coreTermsOf(sf, f, role)) out.add(t.token);
  }
  return out;
}
