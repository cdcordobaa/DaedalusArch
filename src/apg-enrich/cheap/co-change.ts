/**
 * Batch 2, proxy 16, GIT CO-CHANGE: evolutionary coupling (Gall, Hajek and Jazayeri 1998; Zimmermann, Weißgerber,
 * Diehl and Zeller 2005) between the project's files and components.
 *
 * History: with `coChangeHistory: 'own'` (default), the repository whose work tree root is the project root; with
 * `'enclosing'`, the repository that contains the project root, restricted to the project directory. Non-merge
 * commits, renames not followed; a commit that changes more than `coChangeMaxFilesPerCommit` files is dropped (bulk
 * formatting, imports, vendoring), as Zimmermann et al. do. Only files that are File nodes of the current APG count.
 * No git binary, no repository or no commit: the proxy writes nothing and says why in its summary.
 *
 * CO_CHANGES_WITH (File ↔ File, emitted once per unordered pair, source < target): support = commits that changed
 * both; confidence(a → b) = support / commits that changed a. Emitted when support ≥ `coChangeMinSupport` (k,
 * default 3).
 *
 * Component matrix: for each component pair, the commits that changed a file of each, and the Jaccard share of those
 * among the commits that changed either. A component pair is COUPLED when some file pair across it has an edge with
 * max(confidence) ≥ `coChangeMinConfidence` (default 0.5).
 *
 * Flag `hidden-coupling`: a coupled component pair with no static dependency between the two components in either
 * direction: no IMPORTS (any view), RE_EXPORTS, CALLS, CONSTRUCTOR_INJECTS, EXTENDS, IMPLEMENTS, FLOWS_TO or
 * SIGNATURE_USES edge between a node of one and a node of the other. One flag per pair, at its strongest file pair.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CheapContext } from './context.js';
import { commitFileSets, git } from './git.js';
import type { CheapEdge, CheapFlag, CheapProxyOutput } from './types.js';

const STATIC_EDGES = new Set(['IMPORTS', 'RE_EXPORTS', 'CALLS', 'CONSTRUCTOR_INJECTS', 'EXTENDS', 'IMPLEMENTS', 'FLOWS_TO', 'SIGNATURE_USES']);

/** The git arguments and path prefix of the project's history, or the reason it has none. */
export function historyOf(root: string, mode: 'own' | 'enclosing'): { gitArgs: string[]; prefix: string } | { skipped: string } {
  if (mode === 'own') {
    if (!fs.existsSync(path.join(root, '.git'))) return { skipped: 'no .git at the project root' };
    const top = git(['-C', root], ['rev-parse', '--show-toplevel']);
    if (top === null) return { skipped: 'git unavailable or not a repository' };
    if (fs.realpathSync(top.trim()) !== fs.realpathSync(root)) return { skipped: 'the .git at the project root is not its work tree root' };
    return { gitArgs: ['-C', root], prefix: '' };
  }
  const top = git(['-C', root], ['rev-parse', '--show-toplevel']);
  if (top === null) return { skipped: 'git unavailable or not inside a repository' };
  const rel = path.relative(fs.realpathSync(top.trim()), fs.realpathSync(root)).split(path.sep).join('/');
  return { gitArgs: ['-C', top.trim()], prefix: rel };
}

export function runCoChange(ctx: CheapContext): CheapProxyOutput {
  const h = historyOf(ctx.root, ctx.options.coChangeHistory);
  if ('skipped' in h) return { edges: [], nodeFacts: [], flags: [], summary: { skipped: h.skipped } };
  const all = commitFileSets(h.gitArgs, h.prefix);
  if (all === null || all.length === 0) return { edges: [], nodeFacts: [], flags: [], summary: { skipped: all === null ? 'git log failed' : 'no commit' } };
  const known = new Set(ctx.files.keys());
  const max = ctx.options.coChangeMaxFilesPerCommit;
  const commits = all.filter((c) => c.files.length <= max).map((c) => ({ sha: c.sha, files: [...new Set(c.files.filter((f) => known.has(f)))].sort() })).filter((c) => c.files.length > 0);
  const dropped = all.filter((c) => c.files.length > max).length;
  const changes = new Map<string, number>();
  const pairs = new Map<string, number>();
  for (const c of commits) {
    for (const f of c.files) changes.set(f, (changes.get(f) ?? 0) + 1);
    for (let i = 0; i < c.files.length; i++) for (let j = i + 1; j < c.files.length; j++) {
      const k = `${c.files[i] ?? ''}\u0000${c.files[j] ?? ''}`;
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  const edges: CheapEdge[] = [];
  const coupledComponents = new Map<string, { a: string; b: string; conf: number; support: number }>();
  for (const [k, support] of [...pairs.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (support < ctx.options.coChangeMinSupport) continue;
    const [a, b] = k.split('\u0000') as [string, string];
    const confAB = support / (changes.get(a) ?? support);
    const confBA = support / (changes.get(b) ?? support);
    const ia = ctx.info(a);
    const ib = ctx.info(b);
    if (ia.fileNodeId !== undefined && ib.fileNodeId !== undefined) {
      edges.push({ type: 'CO_CHANGES_WITH', proxy: 'co-change', sourceId: ia.fileNodeId, targetId: ib.fileNodeId, score: Math.max(confAB, confBA), evidence: [{ file: a, startLine: 1, endLine: 1 }, { file: b, startLine: 1, endLine: 1 }], properties: { support, confidence: round(confAB), reverseConfidence: round(confBA), crossComponent: ia.component !== ib.component } });
    }
    const conf = Math.max(confAB, confBA);
    if (ia.component !== ib.component && conf >= ctx.options.coChangeMinConfidence) {
      const ck = [ia.component, ib.component].sort().join('\u0000');
      const prev = coupledComponents.get(ck);
      if (prev === undefined || conf > prev.conf || (conf === prev.conf && support > prev.support)) coupledComponents.set(ck, { a, b, conf, support });
    }
  }
  // Component evolutionary coupling matrix.
  const compCommits = new Map<string, Set<string>>();
  for (const c of commits) for (const f of c.files) {
    const comp = ctx.info(f).component;
    const s = compCommits.get(comp) ?? new Set<string>();
    s.add(c.sha);
    compCommits.set(comp, s);
  }
  const comps = [...compCommits.keys()].sort();
  const matrix: Record<string, Record<string, { commits: number; jaccard: number }>> = {};
  for (const x of comps) for (const y of comps) {
    if (x >= y) continue;
    const sx = compCommits.get(x) ?? new Set<string>();
    const sy = compCommits.get(y) ?? new Set<string>();
    let both = 0;
    for (const s of sx) if (sy.has(s)) both++;
    if (both === 0) continue;
    (matrix[x] ??= {})[y] = { commits: both, jaccard: round(both / (sx.size + sy.size - both)) };
  }
  // Static component dependencies (either direction).
  const compOfNode = new Map<string, string>();
  for (const n of ctx.apg.nodes) if (ctx.files.has(n.filePath)) compOfNode.set(n.id, ctx.info(n.filePath).component);
  const staticPairs = new Set<string>();
  for (const e of ctx.apg.edges) {
    if (!STATIC_EDGES.has(e.type)) continue;
    const a = compOfNode.get(e.sourceId);
    const b = compOfNode.get(e.targetId);
    if (a !== undefined && b !== undefined && a !== b) staticPairs.add([a, b].sort().join('\u0000'));
  }
  const flags: CheapFlag[] = [];
  for (const [ck, best] of [...coupledComponents.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (staticPairs.has(ck)) continue;
    const [ca, cb] = ck.split('\u0000') as [string, string];
    flags.push({
      proxy: 'co-change', kind: 'hidden-coupling', score: best.conf, evidence: { file: best.a, startLine: 1, endLine: 1 },
      message: `components ${ca} and ${cb} change together (${best.a} and ${best.b}: ${String(best.support)} commits, confidence ${best.conf.toFixed(2)}) but have no static dependency`,
      related: { file: best.b, startLine: 1, endLine: 1 },
    });
  }
  return {
    edges, nodeFacts: [], flags,
    summary: { history: ctx.options.coChangeHistory, commits: all.length, commitsUsed: commits.length, commitsDroppedLarge: dropped, filePairs: edges.length, coupledComponentPairs: coupledComponents.size, matrix, flagsByKind: { 'hidden-coupling': flags.length } },
  };
}

function round(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
