/**
 * Cypher text → interpreter AST. The concrete syntax tree comes from Neo4j's own Cypher grammar (the `Cypher25`
 * grammar files that `@neo4j-cypher/language-support` exports, generated into `generated/` by
 * `scripts/v1.3/gen-cypher-parser.sh`); this file only maps that tree onto the subset in `ast.ts`.
 *
 * Two error classes, never a guess:
 * - `CypherSyntaxError`: the text does not parse under Neo4j's grammar (Neo4j would reject it too);
 * - `CypherUnsupportedError`: valid Cypher outside the interpreter's subset (writes, CALL, UNION, GDS, QPP, ...).
 */
import { checkStaticTypes } from './typecheck.js';
import { BaseErrorListener, CharStream, CommonTokenStream, ParserRuleContext, TerminalNode } from 'antlr4ng';
import type { ParseTree, RecognitionException, Recognizer, Token, ATNSimulator } from 'antlr4ng';
import { Cypher25Lexer } from './generated/Cypher25Lexer.js';
import { Cypher25Parser } from './generated/Cypher25Parser.js';
import type { BinaryOp, Clause, Direction, Expr, LabelExpr, NodePattern, PatternPart, Projection, ProjectionItem, Query, RelPattern, SortItem } from './ast.js';
import type { Value } from './values.js';

export class CypherSyntaxError extends Error {
  readonly code = 'Neo.ClientError.Statement.SyntaxError';
  constructor(message: string) {
    super(message);
    this.name = 'CypherSyntaxError';
  }
}

export class CypherUnsupportedError extends Error {
  readonly code = 'CypherInterp.Unsupported';
  constructor(message: string) {
    super(`cypher-interp: unsupported: ${message}`);
    this.name = 'CypherUnsupportedError';
  }
}

class ThrowingListener extends BaseErrorListener {
  readonly errors: string[] = [];
  override syntaxError<T extends ATNSimulator>(_r: Recognizer<T>, _s: Token | null, line: number, column: number, msg: string, _e: RecognitionException | null): void {
    this.errors.push(`line ${String(line)}:${String(column)} ${msg}`);
  }
}

type Ctx = ParserRuleContext;

const RULES = Cypher25Parser.ruleNames;

function ruleOf(t: ParseTree): string | undefined {
  return t instanceof ParserRuleContext ? RULES[t.ruleIndex] : undefined;
}

function kids(c: Ctx): readonly ParseTree[] {
  return c.children;
}

function isTok(t: ParseTree | undefined, text: string): boolean {
  return t instanceof TerminalNode && t.getText().toUpperCase() === text;
}

function hasTok(c: Ctx, text: string): boolean {
  return kids(c).some((k) => isTok(k, text));
}

function rules(c: Ctx, name: string): Ctx[] {
  return kids(c).filter((k): k is Ctx => ruleOf(k) === name);
}

function rule(c: Ctx, name: string): Ctx | undefined {
  return rules(c, name)[0];
}

function need(c: Ctx, name: string): Ctx {
  const r = rule(c, name);
  if (r === undefined) throw new CypherUnsupportedError(`expected ${name} in ${ruleOf(c) ?? '?'}`);
  return r;
}

/** Rejects any child rule of `c` outside `allowed` (terminals are checked by the caller). */
function onlyRules(c: Ctx, allowed: readonly string[]): void {
  for (const k of kids(c)) {
    const r = ruleOf(k);
    if (r !== undefined && !allowed.includes(r)) throw new CypherUnsupportedError(`${r} in ${ruleOf(c) ?? '?'}`);
  }
}

class Builder {
  constructor(private readonly text: string) {}

  /** The query text a context spans (unaliased RETURN column names). */
  textOf(c: Ctx): string {
    const a = c.start?.start ?? 0;
    const b = c.stop?.stop ?? a - 1;
    return this.text.slice(a, b + 1);
  }

  statements(c: Ctx): Query {
    const stmts = rules(c, 'statement');
    if (stmts.length !== 1) throw new CypherUnsupportedError('more than one statement');
    const s = stmts[0] as Ctx;
    const q = rule(s, 'queryWithLocalDefinitions');
    if (q === undefined) throw new CypherUnsupportedError('administration command');
    return this.queryWithLocalDefinitions(q);
  }

  queryWithLocalDefinitions(c: Ctx): Query {
    if (rule(c, 'localDefinition') !== undefined) throw new CypherUnsupportedError('DEFINE');
    const next = need(c, 'nextStatement');
    const regs = rules(next, 'regularQuery');
    if (regs.length !== 1) throw new CypherUnsupportedError('NEXT');
    const reg = regs[0] as Ctx;
    const union = rule(reg, 'union');
    if (union === undefined) throw new CypherUnsupportedError('WHEN query');
    const singles = rules(union, 'singleQuery');
    if (singles.length !== 1) throw new CypherUnsupportedError('UNION');
    const single = singles[0] as Ctx;
    if (rule(single, 'clause') === undefined) throw new CypherUnsupportedError('braced query');
    return { clauses: rules(single, 'clause').map((cl) => this.clause(cl)) };
  }

  clause(c: Ctx): Clause {
    const inner = kids(c)[0] as Ctx;
    switch (ruleOf(inner)) {
      case 'matchClause': return this.matchClause(inner);
      case 'withClause': {
        const where = rule(inner, 'whereClause');
        return { k: 'with', projection: this.returnBody(need(inner, 'returnBody'), 'WITH'), where: where === undefined ? undefined : this.whereClause(where) };
      }
      case 'returnClause': return { k: 'return', projection: this.returnBody(need(inner, 'returnBody'), 'RETURN') };
      case 'unwindClause': return { k: 'unwind', expr: this.expression(need(inner, 'expression')), alias: this.variable(need(inner, 'variable')) };
      default: throw new CypherUnsupportedError(`clause ${ruleOf(inner) ?? '?'}`);
    }
  }

  whereClause(c: Ctx): Expr {
    return this.expression(need(c, 'expression'));
  }

  matchClause(c: Ctx): Clause {
    onlyRules(c, ['patternList', 'whereClause']);
    const where = rule(c, 'whereClause');
    return {
      k: 'match',
      optional: hasTok(c, 'OPTIONAL'),
      patterns: this.patternList(need(c, 'patternList')),
      where: where === undefined ? undefined : this.whereClause(where),
    };
  }

  patternList(c: Ctx): PatternPart[] {
    return rules(c, 'pattern').map((p) => this.pattern(p));
  }

  pattern(c: Ctx): PatternPart {
    onlyRules(c, ['variable', 'anonymousPattern']);
    const v = rule(c, 'variable');
    const anon = need(c, 'anonymousPattern');
    const el = rule(anon, 'patternElement');
    if (el === undefined) throw new CypherUnsupportedError('shortestPath');
    const nodes: NodePattern[] = [];
    const rels: RelPattern[] = [];
    let expectNode = true;
    for (const k of kids(el)) {
      const r = ruleOf(k);
      if (r === 'nodePattern' && expectNode) { nodes.push(this.nodePattern(k as Ctx)); expectNode = false; }
      else if (r === 'relationshipPattern' && !expectNode) { rels.push(this.relationshipPattern(k as Ctx)); expectNode = true; }
      else throw new CypherUnsupportedError(r === 'quantifier' || r === 'parenthesizedPath' ? 'quantified path pattern' : `pattern element ${r ?? '?'}`);
    }
    if (expectNode) throw new CypherUnsupportedError('pattern ending in a relationship');
    return { pathVariable: v === undefined ? undefined : this.variable(v), nodes, rels };
  }

  nodePattern(c: Ctx): NodePattern {
    onlyRules(c, ['variable', 'labelExpression', 'properties', 'expression']);
    const v = rule(c, 'variable');
    const l = rule(c, 'labelExpression');
    const p = rule(c, 'properties');
    const w = rule(c, 'expression');
    return {
      variable: v === undefined ? undefined : this.variable(v),
      label: l === undefined ? undefined : this.labelExpression(l),
      properties: p === undefined ? undefined : this.properties(p),
      where: w === undefined ? undefined : this.expression(w),
    };
  }

  relationshipPattern(c: Ctx): RelPattern {
    onlyRules(c, ['leftArrow', 'arrowLine', 'rightArrow', 'variable', 'labelExpression', 'pathLength', 'properties', 'expression']);
    const left = rule(c, 'leftArrow') !== undefined;
    const right = rule(c, 'rightArrow') !== undefined;
    const direction: Direction = left === right ? 'both' : left ? 'in' : 'out';
    const v = rule(c, 'variable');
    const l = rule(c, 'labelExpression');
    const len = rule(c, 'pathLength');
    const p = rule(c, 'properties');
    const w = rule(c, 'expression');
    return {
      variable: v === undefined ? undefined : this.variable(v),
      types: l === undefined ? undefined : this.labelExpression(l),
      direction,
      range: len === undefined ? undefined : this.pathLength(len),
      properties: p === undefined ? undefined : this.properties(p),
      where: w === undefined ? undefined : this.expression(w),
    };
  }

  pathLength(c: Ctx): { min: number; max: number | undefined } {
    const parts = kids(c).slice(1); // after '*'
    if (parts.length === 0) return { min: 1, max: undefined };
    const ints = (t: ParseTree | undefined): number | undefined => (t instanceof TerminalNode && /^\d+$/.test(t.getText()) ? Number(t.getText()) : undefined);
    const dots = parts.findIndex((t) => isTok(t, '..'));
    if (dots < 0) {
      const n = ints(parts[0]);
      if (n === undefined) throw new CypherUnsupportedError('path length');
      return { min: n, max: n };
    }
    const from = dots > 0 ? ints(parts[dots - 1]) : undefined;
    const to = ints(parts[dots + 1]);
    return { min: from ?? 1, max: to };
  }

  properties(c: Ctx): Expr {
    const m = rule(c, 'map');
    if (m !== undefined) return this.map(m);
    return this.parameter(need(c, 'parameter'));
  }

  labelExpression(c: Ctx): LabelExpr {
    return this.labelExpression4(need(c, 'labelExpression4'));
  }

  labelExpression4(c: Ctx): LabelExpr {
    const items = rules(c, 'labelExpression3').map((x) => this.labelExpression3(x));
    return items.length === 1 ? (items[0] as LabelExpr) : { k: 'or', items };
  }

  labelExpression3(c: Ctx): LabelExpr {
    const items = rules(c, 'labelExpression2').map((x) => this.labelExpression2(x));
    return items.length === 1 ? (items[0] as LabelExpr) : { k: 'and', items };
  }

  labelExpression2(c: Ctx): LabelExpr {
    let e = this.labelExpression1(need(c, 'labelExpression1'));
    const nots = kids(c).filter((k) => isTok(k, '!')).length;
    for (let i = 0; i < nots; i++) e = { k: 'not', e };
    return e;
  }

  labelExpression1(c: Ctx): LabelExpr {
    const le4 = rule(c, 'labelExpression4');
    if (le4 !== undefined) return this.labelExpression4(le4);
    if (hasTok(c, '%')) return { k: 'any' };
    const name = rule(c, 'symbolicNameString');
    if (name === undefined) throw new CypherUnsupportedError('dynamic label');
    return { k: 'name', name: this.symbolicName(name) };
  }

  returnBody(c: Ctx, clause: 'WITH' | 'RETURN'): Projection {
    onlyRules(c, ['returnItems', 'orderBy', 'skip', 'limit']);
    const itemsCtx = need(c, 'returnItems');
    const star = isTok(kids(itemsCtx)[0], '*');
    const items: ProjectionItem[] = rules(itemsCtx, 'returnItem').map((it) => {
      const e = need(it, 'expression');
      const expr = this.expression(e);
      const alias = rule(it, 'variable');
      if (alias !== undefined) return { expr, alias: this.variable(alias) };
      if (expr.k === 'var') return { expr, alias: expr.name };
      if (clause === 'WITH') throw new CypherSyntaxError('Expression in WITH must be aliased (use AS)');
      return { expr, alias: this.textOf(e) };
    });
    const orderBy = rule(c, 'orderBy');
    const skip = rule(c, 'skip');
    const limit = rule(c, 'limit');
    return {
      distinct: hasTok(c, 'DISTINCT'),
      star,
      items,
      orderBy: orderBy === undefined ? [] : rules(orderBy, 'orderItem').map((o): SortItem => ({
        expr: this.expression(need(o, 'expression')),
        descending: rule(o, 'descToken') !== undefined,
      })),
      skip: skip === undefined ? undefined : this.expression(need(skip, 'expression')),
      limit: limit === undefined ? undefined : this.expression(need(limit, 'expression')),
    };
  }

  // ── names ──

  variable(c: Ctx): string {
    const s = need(c, 'symbolicVariableNameString');
    return this.nameText(s);
  }

  symbolicName(c: Ctx): string {
    return this.nameText(c);
  }

  private nameText(c: Ctx): string {
    const text = c.getText();
    if (text.startsWith('`')) return text.slice(1, -1).replace(/``/g, '`');
    return text;
  }

  // ── expressions ──

  expression(c: Ctx): Expr {
    switch (ruleOf(c)) {
      case 'expression': return this.leftAssoc(c, 'expression11', { OR: 'OR' });
      case 'expression11': return this.leftAssoc(c, 'expression10', { XOR: 'XOR' });
      case 'expression10': return this.leftAssoc(c, 'expression9', { AND: 'AND' });
      case 'expression9': {
        let e = this.expression(need(c, 'expression8'));
        const nots = kids(c).filter((k) => isTok(k, 'NOT')).length;
        for (let i = 0; i < nots; i++) e = { k: 'not', e };
        return e;
      }
      case 'expression8': return this.comparisonChain(c);
      case 'expression7': return this.expression7(c);
      case 'expression6': return this.leftAssoc(c, 'expression5', { '+': '+', '-': '-' });
      case 'expression5': return this.leftAssoc(c, 'expression4', { '*': '*', '/': '/', '%': '%' });
      case 'expression4': return this.leftAssoc(c, 'expression3', { '^': '^' });
      case 'expression3': {
        const e = this.expression(need(c, 'expression2'));
        if (isTok(kids(c)[0], '-')) return { k: 'neg', e };
        return e;
      }
      case 'expression2': return this.expression2(c);
      case 'expression1': return this.expression1(c);
      default: throw new CypherUnsupportedError(`expression ${ruleOf(c) ?? '?'}`);
    }
  }

  private leftAssoc(c: Ctx, sub: string, ops: Readonly<Record<string, BinaryOp>>): Expr {
    let acc: Expr | undefined;
    let op: BinaryOp | undefined;
    for (const k of kids(c)) {
      if (ruleOf(k) === sub) {
        const e = this.expression(k as Ctx);
        acc = acc === undefined ? e : { k: 'bin', op: op as BinaryOp, l: acc, r: e };
      } else if (k instanceof TerminalNode) {
        const t = k.getText().toUpperCase();
        const mapped = ops[t];
        if (mapped === undefined) throw new CypherUnsupportedError(`operator ${t}`);
        op = mapped;
      } else throw new CypherUnsupportedError(`${ruleOf(k) ?? '?'} in ${ruleOf(c) ?? '?'}`);
    }
    if (acc === undefined) throw new CypherUnsupportedError(`empty ${ruleOf(c) ?? '?'}`);
    return acc;
  }

  /** `a < b <= c` is `a < b AND b <= c` (openCypher chained comparison). */
  private comparisonChain(c: Ctx): Expr {
    const operands: Expr[] = [];
    const ops: BinaryOp[] = [];
    for (const k of kids(c)) {
      if (ruleOf(k) === 'expression7') operands.push(this.expression(k as Ctx));
      else {
        const t = (k as TerminalNode).getText();
        if (t === '!=') throw new CypherSyntaxError("Unknown operation '!=' (you probably meant to use '<>')");
        if (!['=', '<>', '<', '>', '<=', '>='].includes(t)) throw new CypherUnsupportedError(`operator ${t}`);
        ops.push(t as BinaryOp);
      }
    }
    if (ops.length === 0) return operands[0] as Expr;
    let acc: Expr | undefined;
    for (let i = 0; i < ops.length; i++) {
      const cmp: Expr = { k: 'bin', op: ops[i] as BinaryOp, l: operands[i] as Expr, r: operands[i + 1] as Expr };
      acc = acc === undefined ? cmp : { k: 'bin', op: 'AND', l: acc, r: cmp };
    }
    return acc as Expr;
  }

  private expression7(c: Ctx): Expr {
    const left = this.expression(need(c, 'expression6'));
    const cmp = rule(c, 'comparisonExpression6');
    if (cmp === undefined) return left;
    const ks = kids(cmp);
    const first = (ks[0] as TerminalNode | undefined)?.getText().toUpperCase();
    const rhs = rule(cmp, 'expression6');
    if (rhs !== undefined) {
      const r = this.expression(rhs);
      const op: BinaryOp | undefined = first === '=~' ? '=~' : first === 'STARTS' ? 'STARTS WITH' : first === 'ENDS' ? 'ENDS WITH' : first === 'CONTAINS' ? 'CONTAINS' : first === 'IN' ? 'IN' : undefined;
      if (op === undefined) throw new CypherUnsupportedError(`comparison ${first ?? '?'}`);
      return { k: 'bin', op, l: left, r };
    }
    if (hasTok(cmp, 'NULL') && rule(cmp, 'type') === undefined) return { k: 'isNull', e: left, negated: hasTok(cmp, 'NOT') };
    const le = rule(cmp, 'labelExpression4');
    if (le !== undefined) {
      const e: Expr = { k: 'hasLabel', e: left, label: this.labelExpression4(le) };
      return hasTok(cmp, 'NOT') ? { k: 'not', e } : e;
    }
    throw new CypherUnsupportedError('type or normalization predicate');
  }

  private expression2(c: Ctx): Expr {
    let e = this.expression(need(c, 'expression1'));
    for (const pf of rules(c, 'postFix')) {
      const prop = rule(pf, 'property');
      if (prop !== undefined) { e = { k: 'prop', obj: e, key: this.symbolicName(need(need(prop, 'propertyKeyName'), 'symbolicNameString')) }; continue; }
      const pk = kids(pf);
      const dots = pk.findIndex((t) => isTok(t, '..'));
      if (dots < 0) { e = { k: 'index', obj: e, idx: this.expression(need(pf, 'expression')) }; continue; }
      const before = pk[dots - 1];
      const after = pk[dots + 1];
      e = {
        k: 'slice', obj: e,
        from: ruleOf(before as ParseTree) === 'expression' ? this.expression(before as Ctx) : undefined,
        to: ruleOf(after as ParseTree) === 'expression' ? this.expression(after as Ctx) : undefined,
      };
    }
    return e;
  }

  private expression1(c: Ctx): Expr {
    const inner = kids(c)[0] as Ctx;
    switch (ruleOf(inner)) {
      case 'literal': return this.literal(inner);
      case 'parameter': return this.parameter(inner);
      case 'variable': return { k: 'var', name: this.variable(inner) };
      case 'parenthesizedExpression': return this.expression(need(inner, 'expression'));
      case 'listLiteral': return { k: 'list', items: rules(inner, 'expression').map((x) => this.expression(x)) };
      case 'countStar': return { k: 'countStar' };
      case 'functionInvocation': return this.functionInvocation(inner);
      case 'caseExpression': return this.caseExpression(inner);
      case 'extendedCaseExpression': return this.extendedCaseExpression(inner);
      case 'existsExpression': return this.existsExpression(inner);
      case 'listComprehension': return this.listComprehension(inner);
      case 'listItemsPredicate': return this.listItemsPredicate(inner);
      case 'reduceExpression': return this.reduceExpression(inner);
      default: throw new CypherUnsupportedError(`expression ${ruleOf(inner) ?? '?'}`);
    }
  }

  literal(c: Ctx): Expr {
    const inner = kids(c)[0] as ParseTree;
    const r = ruleOf(inner);
    if (r === 'numberLiteral') return { k: 'lit', v: numberLiteral((inner as Ctx).getText()) };
    if (r === 'stringLiteral') return { k: 'lit', v: unescapeString((inner as Ctx).getText()) };
    if (r === 'map') return this.map(inner as Ctx);
    const t = (inner as TerminalNode).getText().toUpperCase();
    const v: Value | undefined = t === 'TRUE' ? true : t === 'FALSE' ? false : t === 'NULL' ? null : t === 'NAN' ? Number.NaN : t === 'INF' || t === 'INFINITY' ? Infinity : undefined;
    if (v === undefined) throw new CypherUnsupportedError(`literal ${t}`);
    return { k: 'lit', v };
  }

  map(c: Ctx): Expr {
    const keys = rules(c, 'propertyKeyName').map((k) => this.symbolicName(need(k, 'symbolicNameString')));
    const vals = rules(c, 'expression').map((e) => this.expression(e));
    return { k: 'map', entries: keys.map((k, i) => [k, vals[i] as Expr] as const) };
  }

  parameter(c: Ctx): Expr {
    const n = need(c, 'parameterName');
    const s = rule(n, 'symbolicNameString');
    return { k: 'param', name: s === undefined ? n.getText() : this.symbolicName(s) };
  }

  functionInvocation(c: Ctx): Expr {
    const fnName = need(c, 'functionName');
    const ns = rule(fnName, 'namespace');
    const parts = ns === undefined ? [] : rules(ns, 'symbolicNameString').map((s) => this.symbolicName(s));
    parts.push(this.symbolicName(need(fnName, 'symbolicNameString')));
    return {
      k: 'fn',
      name: parts.join('.'),
      distinct: hasTok(c, 'DISTINCT'),
      args: rules(c, 'functionArgument').map((a) => this.expression(need(a, 'expression'))),
    };
  }

  caseExpression(c: Ctx): Expr {
    const whens = rules(c, 'caseAlternative').map((a) => {
      const es = rules(a, 'expression');
      return [this.expression(es[0] as Ctx), this.expression(es[1] as Ctx)] as const;
    });
    const otherwise = rule(c, 'expression');
    return { k: 'case', subject: undefined, whens, otherwise: otherwise === undefined ? undefined : this.expression(otherwise) };
  }

  extendedCaseExpression(c: Ctx): Expr {
    const es = rules(c, 'expression');
    const subject = this.expression(es[0] as Ctx);
    const whens = rules(c, 'extendedCaseAlternative').map((a) => {
      const ws = rules(a, 'extendedWhen');
      if (ws.length !== 1) throw new CypherUnsupportedError('CASE WHEN with several values');
      const w = ws[0] as Ctx;
      const we = rule(w, 'expression');
      if (we === undefined || kids(w).length !== 1) throw new CypherUnsupportedError('CASE WHEN comparison form');
      return [this.expression(we), this.expression(need(a, 'expression'))] as const;
    });
    const otherwise = es[1];
    return { k: 'case', subject, whens, otherwise: otherwise === undefined ? undefined : this.expression(otherwise) };
  }

  existsExpression(c: Ctx): Expr {
    onlyRules(c, ['queryWithLocalDefinitions', 'patternList', 'whereClause']);
    const q = rule(c, 'queryWithLocalDefinitions');
    if (q !== undefined) return { k: 'exists', query: this.queryWithLocalDefinitions(q) };
    const where = rule(c, 'whereClause');
    return {
      k: 'exists',
      query: { clauses: [{ k: 'match', optional: false, patterns: this.patternList(need(c, 'patternList')), where: where === undefined ? undefined : this.whereClause(where) }] },
    };
  }

  listComprehension(c: Ctx): Expr {
    const v = this.variable(need(c, 'variable'));
    let list: Expr | undefined;
    let where: Expr | undefined;
    let map: Expr | undefined;
    let mode: 'list' | 'where' | 'map' = 'list';
    for (const k of kids(c)) {
      if (isTok(k, 'WHERE')) mode = 'where';
      else if (isTok(k, '|')) mode = 'map';
      else if (ruleOf(k) === 'expression') {
        const e = this.expression(k as Ctx);
        if (mode === 'list') list = e; else if (mode === 'where') where = e; else map = e;
      }
    }
    if (list === undefined) throw new CypherUnsupportedError('list comprehension');
    return { k: 'listComp', v, list, where, map };
  }

  listItemsPredicate(c: Ctx): Expr {
    const q = (kids(c)[0] as TerminalNode).getText().toLowerCase() as 'all' | 'any' | 'none' | 'single';
    const es = rules(c, 'expression');
    if (es.length !== 2) throw new CypherUnsupportedError(`${q}() without WHERE`);
    return { k: 'quant', q, v: this.variable(need(c, 'variable')), list: this.expression(es[0] as Ctx), where: this.expression(es[1] as Ctx) };
  }

  reduceExpression(c: Ctx): Expr {
    const vs = rules(c, 'variable');
    const es = rules(c, 'expression');
    return {
      k: 'reduce',
      acc: this.variable(vs[0] as Ctx), init: this.expression(es[0] as Ctx),
      v: this.variable(vs[1] as Ctx), list: this.expression(es[1] as Ctx),
      expr: this.expression(es[2] as Ctx),
    };
  }
}

function numberLiteral(text: string): Value {
  const neg = text.startsWith('-');
  const body = (neg ? text.slice(1) : text).replace(/_/g, '');
  let v: bigint | number;
  if (/^0x/i.test(body)) v = BigInt(body);
  else if (/^0o/i.test(body)) v = BigInt(body);
  else if (/^\d+$/.test(body)) v = BigInt(body);
  else v = Number(body);
  return neg ? (typeof v === 'bigint' ? -v : -v) : v;
}

function unescapeString(text: string): string {
  const body = text.slice(1, -1);
  return body.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_m, e: string) => {
    switch (e[0]) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case 'b': return '\b';
      case 'f': return '\f';
      case '\\': return '\\';
      case "'": return "'";
      case '"': return '"';
      case 'u': case 'U': return String.fromCodePoint(parseInt(e.slice(1), 16));
      default: return `\\${e}`;
    }
  });
}

const cache = new Map<string, Query>();

/** Parses one read query (cached by text). Throws `CypherSyntaxError` or `CypherUnsupportedError`. */
export function parseCypher(text: string): Query {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const listener = new ThrowingListener();
  const lexer = new Cypher25Lexer(CharStream.fromString(text));
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);
  const parser = new Cypher25Parser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);
  const tree = parser.statements();
  if (listener.errors.length > 0) throw new CypherSyntaxError(`Invalid Cypher: ${listener.errors.join('; ')}`);
  const q = new Builder(text).statements(tree);
  checkStaticTypes(q);
  cache.set(text, q);
  return q;
}
