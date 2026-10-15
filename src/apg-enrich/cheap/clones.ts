/**
 * Proxy 1, CLONES (Roy and Cordy 2007): Type-1/Type-2 clones by normalised token hashes, Type-3 near-clones by
 * token-shingle Jaccard similarity.
 *
 * Units: every method, accessor and top-level function body, and every top-level compound statement of such a body
 * (`if`, `switch`, `try`, loops) — the granularity at which a duplicated business rule (a guard) lives. Tokens are the
 * leaf tokens of the AST with identifiers mapped to `$id`, numbers to `$num`, strings and templates to `$str`;
 * keywords and operators stay. A body shorter than `cloneMinBodyTokens` or a fragment shorter than `cloneMinTokens`
 * is not compared, and a fragment must hold a value comparison or numeric arithmetic (`densityOf`): a rule, not a
 * bare existence check (`if (!x) throw …`), whose Type-2 shape every component shares.
 *
 * Emits SAME_LOGIC_AS between the enclosing Method / Function nodes, with the similarity, the clone type and whether
 * the two ends lie in different components; flags the cross-component pairs.
 */
import { createHash } from 'node:crypto';
import { Node, SyntaxKind, ts } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { densityOf, topLevelFunctions } from './behaviour.js';
import type { CheapEdge, CheapFlag, CheapProxyOutput, Evidence } from './types.js';

interface CloneUnit {
  readonly granularity: 'body' | 'fragment';
  readonly file: string;
  readonly component: string;
  readonly className: string | undefined;
  readonly methodName: string;
  readonly nodeId: string | undefined;
  readonly evidence: Evidence;
  readonly tokens: readonly string[];
  readonly hash: string;
  readonly shingles: ReadonlySet<string>;
}

const COMPOUND = new Set([
  SyntaxKind.IfStatement, SyntaxKind.SwitchStatement, SyntaxKind.TryStatement, SyntaxKind.ForStatement,
  SyntaxKind.ForOfStatement, SyntaxKind.ForInStatement, SyntaxKind.WhileStatement, SyntaxKind.DoStatement,
]);

/** Normalised leaf tokens of a node (see the module comment). */
export function normalisedTokens(node: Node): string[] {
  const out: string[] = [];
  const sf = node.getSourceFile().compilerNode;
  const walk = (n: ts.Node): void => {
    if (n.kind >= SyntaxKind.FirstJSDocNode && n.kind <= SyntaxKind.LastJSDocNode) return;
    const kids = n.getChildren(sf);
    if (kids.length === 0) {
      const k = n.kind;
      if (k === SyntaxKind.EndOfFileToken) return;
      if (k === SyntaxKind.Identifier || k === SyntaxKind.PrivateIdentifier) out.push('$id');
      else if (k === SyntaxKind.NumericLiteral || k === SyntaxKind.BigIntLiteral) out.push('$num');
      else if (k === SyntaxKind.StringLiteral || k === SyntaxKind.NoSubstitutionTemplateLiteral || k === SyntaxKind.TemplateHead || k === SyntaxKind.TemplateMiddle || k === SyntaxKind.TemplateTail || k === SyntaxKind.RegularExpressionLiteral) out.push('$str');
      else out.push(n.getText(sf));
      return;
    }
    for (const c of kids) walk(c);
  };
  walk(node.compilerNode);
  return out;
}

export function shinglesOf(tokens: readonly string[], k: number): Set<string> {
  const out = new Set<string>();
  if (tokens.length < k) {
    out.add(tokens.join(' '));
    return out;
  }
  for (let i = 0; i + k <= tokens.length; i++) out.add(tokens.slice(i, i + k).join(' '));
  return out;
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function collectUnits(ctx: CheapContext): CloneUnit[] {
  const { cloneMinTokens, cloneMinBodyTokens, shingleSize } = ctx.options;
  const units: CloneUnit[] = [];
  const add = (granularity: CloneUnit['granularity'], file: string, node: Node, className: string | undefined, methodName: string, nodeId: string | undefined): void => {
    const tokens = normalisedTokens(node);
    if (tokens.length < (granularity === 'body' ? Math.max(cloneMinTokens, cloneMinBodyTokens) : cloneMinTokens)) return;
    if (granularity === 'fragment') {
      const d = densityOf(node);
      if (d.comparisons + d.arithmetic === 0) return;
    }
    units.push({
      granularity, file, component: ctx.info(file).component, className, methodName, nodeId,
      evidence: ctx.evidence(node), tokens,
      hash: createHash('sha1').update(tokens.join(' ')).digest('hex'),
      shingles: shinglesOf(tokens, shingleSize),
    });
  };
  const addBody = (file: string, body: Node | undefined, className: string | undefined, methodName: string, nodeId: string | undefined): void => {
    if (body === undefined) return;
    add('body', file, body, className, methodName, nodeId);
    if (Node.isBlock(body)) for (const st of body.getStatements()) if (COMPOUND.has(st.getKind())) add('fragment', file, st, className, methodName, nodeId);
  };
  for (const { file, sf } of ctx.sources) {
    for (const cls of classesOf(sf)) {
      const cn = cls.getName() ?? '<anonymous>';
      for (const m of [...cls.getMethods(), ...cls.getGetAccessors(), ...cls.getSetAccessors()]) {
        addBody(file, m.getBody(), cn, m.getName(), ctx.nodeId('Method', file, `${cn}.${m.getName()}`));
      }
    }
    for (const f of topLevelFunctions(sf)) addBody(file, f.body, undefined, f.name, ctx.nodeId('Function', file, f.name));
  }
  return units;
}

function contains(a: Evidence, b: Evidence): boolean {
  return a.file === b.file && a.startLine <= b.startLine && a.endLine >= b.endLine;
}

export function runClones(ctx: CheapContext): CheapProxyOutput {
  const units = collectUnits(ctx);
  const edges: CheapEdge[] = [];
  const flags: CheapFlag[] = [];
  const t = ctx.options.nearCloneThreshold;
  let exact = 0;
  let near = 0;
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (b?.granularity !== a.granularity) continue;
      if (a.file === b.file && a.className === b.className && a.methodName === b.methodName) continue;
      if (contains(a.evidence, b.evidence) || contains(b.evidence, a.evidence)) continue;
      const ratio = Math.min(a.shingles.size, b.shingles.size) / Math.max(a.shingles.size, b.shingles.size);
      if (a.hash !== b.hash && ratio < t) continue;
      const sim = a.hash === b.hash ? 1 : jaccard(a.shingles, b.shingles);
      if (sim < t) continue;
      const cloneType = a.hash === b.hash ? 'exact-structural' : 'near';
      if (cloneType === 'exact-structural') exact++;
      else near++;
      const crossComponent = a.component !== b.component;
      if (a.nodeId !== undefined && b.nodeId !== undefined) {
        edges.push({
          type: 'SAME_LOGIC_AS', proxy: 'clones', sourceId: a.nodeId, targetId: b.nodeId, score: sim,
          evidence: [a.evidence, b.evidence],
          properties: { similarity: sim, cloneType, granularity: a.granularity, tokens: Math.min(a.tokens.length, b.tokens.length), crossComponent, components: [a.component, b.component] },
        });
      }
      if (crossComponent) {
        for (const [x, y] of [[a, b], [b, a]] as const) {
          flags.push({
            proxy: 'clones', kind: `cross-component-${cloneType}`, score: sim, evidence: x.evidence,
            ...(x.className !== undefined ? { className: x.className } : {}), methodName: x.methodName,
            message: `${a.granularity} clone (${cloneType}, similarity ${sim.toFixed(2)}) of ${y.className ?? ''}${y.className !== undefined ? '.' : ''}${y.methodName} in component ${y.component}`,
            related: { ...y.evidence, ...(y.className !== undefined ? { className: y.className } : {}), methodName: y.methodName },
          });
        }
      }
    }
  }
  return { edges, nodeFacts: [], flags, summary: { units: units.length, exactPairs: exact, nearPairs: near, crossComponentPairs: flags.length / 2 } };
}
