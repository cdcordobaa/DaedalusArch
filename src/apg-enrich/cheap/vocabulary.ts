/**
 * Proxy 8, VOCABULARY: identifier-based concept tags per component (TF-IDF, Salton and Buckley 1988, over components
 * as documents, in the line of identifier-analysis work such as Kuhn, Ducasse and Gîrba 2007) and cross-component
 * vocabulary leakage.
 *
 * Terms: every identifier of the component's files, split on camel case and `_`, lower-cased, at least 3 letters,
 * minus a stop list of language and framework words. tf = term count / component term count; idf = ln(N / df) over N
 * components. A term with df = N (idf 0) carries no component signal and is ignored.
 *
 * Leakage: a term's owner is the component with the highest tf (strictly). For component C and another component D,
 * leak(C, D) = mass of C's owned-elsewhere terms owned by D / mass of C's discriminative terms. C is flagged when
 * max_D leak(C, D) ≥ `vocabularyLeakThreshold`. With fewer than 3 components the proxy only writes tags.
 */
import { Node } from 'ts-morph';
import type { CheapContext } from './context.js';
import { camelTokens } from './behaviour.js';
import type { CheapFlag, CheapNodeFact, CheapProxyOutput } from './types.js';

const STOP = new Set([
  'the', 'and', 'for', 'get', 'set', 'has', 'new', 'this', 'that', 'with', 'from', 'return', 'async', 'await', 'const',
  'let', 'var', 'void', 'null', 'undefined', 'true', 'false', 'string', 'number', 'boolean', 'object', 'promise',
  'array', 'map', 'filter', 'reduce', 'find', 'some', 'every', 'push', 'length', 'value', 'values', 'data', 'result',
  'error', 'errors', 'list', 'item', 'items', 'type', 'types', 'interface', 'class', 'readonly', 'private', 'public',
  'protected', 'static', 'constructor', 'id', 'ids', 'key', 'keys', 'name', 'index', 'args', 'arg', 'param', 'params',
  'options', 'config', 'create', 'update', 'delete', 'remove', 'save', 'load', 'all', 'one', 'by', 'to', 'of', 'is',
  'service', 'services', 'repository', 'repo', 'controller', 'module', 'dto', 'entity', 'impl', 'factory', 'handler',
  'request', 'response', 'req', 'res', 'body', 'query', 'json', 'http', 'status', 'injectable', 'inject', 'exception',
  'date', 'math', 'json', 'console', 'log', 'record', 'partial', 'error', 'throw', 'execute', 'run', 'main', 'app',
  'use', 'case', 'port', 'adapter', 'domain', 'application', 'infrastructure', 'presentation', 'model', 'models',
]);

export function termsOf(identifier: string): string[] {
  return camelTokens(identifier).map((t) => t.toLowerCase()).filter((t) => t.length >= 3 && /^[a-z]+$/.test(t) && !STOP.has(t));
}

export function runVocabulary(ctx: CheapContext): CheapProxyOutput {
  const counts = new Map<string, Map<string, number>>();
  const filesOf = new Map<string, string[]>();
  for (const { file, sf } of ctx.sources) {
    const comp = ctx.info(file).component;
    filesOf.set(comp, [...(filesOf.get(comp) ?? []), file]);
    const m = counts.get(comp) ?? new Map<string, number>();
    counts.set(comp, m);
    sf.forEachDescendant((n) => {
      if (!Node.isIdentifier(n)) return;
      // Module specifiers and imported package names say nothing about the component's concepts.
      if (n.getFirstAncestor((a) => Node.isImportDeclaration(a)) !== undefined) return;
      for (const t of termsOf(n.getText())) m.set(t, (m.get(t) ?? 0) + 1);
    });
  }
  const comps = [...counts.keys()].sort();
  const N = comps.length;
  const df = new Map<string, number>();
  for (const m of counts.values()) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const total = new Map(comps.map((c) => [c, [...(counts.get(c) ?? new Map<string, number>()).values()].reduce((s, x) => s + x, 0)]));
  const tf = (c: string, t: string): number => (counts.get(c)?.get(t) ?? 0) / Math.max(total.get(c) ?? 0, 1);
  const idf = (t: string): number => Math.log(N / (df.get(t) ?? N));
  const nodeFacts: CheapNodeFact[] = [];
  const flags: CheapFlag[] = [];
  const tags: Record<string, { term: string; tfidf: number }[]> = {};
  const owner = new Map<string, string>();
  for (const t of df.keys()) {
    if (idf(t) === 0) continue;
    let best: string | undefined;
    let bestTf = -1;
    let tie = false;
    for (const c of comps) {
      const v = tf(c, t);
      if (v > bestTf) {
        best = c;
        bestTf = v;
        tie = false;
      } else if (v === bestTf) tie = true;
    }
    if (best !== undefined && !tie) owner.set(t, best);
  }
  const leakage: Record<string, { to: string; share: number } | null> = {};
  for (const c of comps) {
    const m = counts.get(c) ?? new Map<string, number>();
    const ranked = [...m.keys()].map((t) => ({ term: t, tfidf: tf(c, t) * idf(t) })).filter((x) => x.tfidf > 0)
      .sort((a, b) => b.tfidf - a.tfidf || (a.term < b.term ? -1 : 1)).slice(0, ctx.options.vocabularyTopK);
    tags[c] = ranked.map((r) => ({ term: r.term, tfidf: Math.round(r.tfidf * 1e4) / 1e4 }));
    for (const f of filesOf.get(c) ?? []) {
      const id = ctx.info(f).fileNodeId;
      if (id !== undefined) nodeFacts.push({ proxy: 'vocabulary', nodeId: id, key: 'conceptTags', value: ranked.map((r) => r.term) });
    }
    let disc = 0;
    const elsewhere = new Map<string, number>();
    for (const [t, k] of m) {
      const o = owner.get(t);
      if (idf(t) === 0 || o === undefined) continue;
      disc += k;
      if (o !== c) elsewhere.set(o, (elsewhere.get(o) ?? 0) + k);
    }
    const top = [...elsewhere.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    const share = top === undefined || disc === 0 ? 0 : top[1] / disc;
    leakage[c] = top === undefined ? null : { to: top[0], share: Math.round(share * 1e4) / 1e4 };
    if (N >= 3 && top !== undefined && share >= ctx.options.vocabularyLeakThreshold) {
      const firstFile = (filesOf.get(c) ?? [])[0] ?? c;
      flags.push({ proxy: 'vocabulary', kind: 'vocabulary-leakage', score: share, evidence: { file: firstFile, startLine: 1, endLine: 1 }, message: `component ${c}: ${(share * 100).toFixed(0)}% of its discriminative identifier mass belongs to ${top[0]}'s vocabulary` });
    }
  }
  return { edges: [], nodeFacts, flags, summary: { components: N, tags, leakage } };
}
