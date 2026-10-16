/**
 * The read-only Cypher subset the interpreter executes (Docs/v1.3/cypher-interpreter.md §2). `parse.ts` builds it
 * from Neo4j's own grammar and rejects every construct outside it with `CypherUnsupportedError`.
 */
import type { Value } from './values.js';

export type LabelExpr =
  | { readonly k: 'name'; readonly name: string }
  | { readonly k: 'any' }
  | { readonly k: 'not'; readonly e: LabelExpr }
  | { readonly k: 'and'; readonly items: readonly LabelExpr[] }
  | { readonly k: 'or'; readonly items: readonly LabelExpr[] };

export type BinaryOp =
  | 'OR' | 'XOR' | 'AND'
  | '=' | '<>' | '<' | '>' | '<=' | '>='
  | '+' | '-' | '*' | '/' | '%' | '^'
  | '=~' | 'STARTS WITH' | 'ENDS WITH' | 'CONTAINS' | 'IN';

export type Expr =
  | { readonly k: 'lit'; readonly v: Value }
  | { readonly k: 'param'; readonly name: string }
  | { readonly k: 'var'; readonly name: string }
  | { readonly k: 'prop'; readonly obj: Expr; readonly key: string }
  | { readonly k: 'index'; readonly obj: Expr; readonly idx: Expr }
  | { readonly k: 'slice'; readonly obj: Expr; readonly from: Expr | undefined; readonly to: Expr | undefined }
  | { readonly k: 'list'; readonly items: readonly Expr[] }
  | { readonly k: 'map'; readonly entries: readonly (readonly [string, Expr])[] }
  | { readonly k: 'bin'; readonly op: BinaryOp; readonly l: Expr; readonly r: Expr }
  | { readonly k: 'not'; readonly e: Expr }
  | { readonly k: 'neg'; readonly e: Expr }
  | { readonly k: 'isNull'; readonly e: Expr; readonly negated: boolean }
  | { readonly k: 'hasLabel'; readonly e: Expr; readonly label: LabelExpr }
  | { readonly k: 'case'; readonly subject: Expr | undefined; readonly whens: readonly (readonly [Expr, Expr])[]; readonly otherwise: Expr | undefined }
  | { readonly k: 'fn'; readonly name: string; readonly distinct: boolean; readonly args: readonly Expr[] }
  | { readonly k: 'countStar' }
  | { readonly k: 'exists'; readonly query: Query }
  | { readonly k: 'listComp'; readonly v: string; readonly list: Expr; readonly where: Expr | undefined; readonly map: Expr | undefined }
  | { readonly k: 'quant'; readonly q: 'all' | 'any' | 'none' | 'single'; readonly v: string; readonly list: Expr; readonly where: Expr | undefined }
  | { readonly k: 'reduce'; readonly acc: string; readonly init: Expr; readonly v: string; readonly list: Expr; readonly expr: Expr };

export type Direction = 'out' | 'in' | 'both';

export interface NodePattern {
  readonly variable: string | undefined;
  readonly label: LabelExpr | undefined;
  readonly properties: Expr | undefined;
  readonly where: Expr | undefined;
}

export interface RelPattern {
  readonly variable: string | undefined;
  readonly types: LabelExpr | undefined;
  readonly direction: Direction;
  /** Present for a variable-length pattern; `max` undefined = unbounded. */
  readonly range: { readonly min: number; readonly max: number | undefined } | undefined;
  readonly properties: Expr | undefined;
  readonly where: Expr | undefined;
}

export interface PatternPart {
  readonly pathVariable: string | undefined;
  readonly nodes: readonly NodePattern[];
  /** `rels[i]` joins `nodes[i]` and `nodes[i + 1]`. */
  readonly rels: readonly RelPattern[];
}

export interface ProjectionItem {
  readonly expr: Expr;
  readonly alias: string;
}

export interface SortItem {
  readonly expr: Expr;
  readonly descending: boolean;
}

export interface Projection {
  readonly distinct: boolean;
  /** `*` (WITH * / RETURN *): every bound variable, then `items`. */
  readonly star: boolean;
  readonly items: readonly ProjectionItem[];
  readonly orderBy: readonly SortItem[];
  readonly skip: Expr | undefined;
  readonly limit: Expr | undefined;
}

export type Clause =
  | { readonly k: 'match'; readonly optional: boolean; readonly patterns: readonly PatternPart[]; readonly where: Expr | undefined }
  | { readonly k: 'unwind'; readonly expr: Expr; readonly alias: string }
  | { readonly k: 'with'; readonly projection: Projection; readonly where: Expr | undefined }
  | { readonly k: 'return'; readonly projection: Projection }
  /**
   * `CALL { part [UNION [ALL] part]* }`: a returning unit subquery, run once per incoming row. A part that starts with
   * `WITH` imports from the outer row through that projection; any other part sees no outer variable.
   */
  | { readonly k: 'call'; readonly parts: readonly Query[]; readonly unionAll: boolean };

export interface Query {
  readonly clauses: readonly Clause[];
}
