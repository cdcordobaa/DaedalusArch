/**
 * P4 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * SG1 (layered dependency rule): with ranks presentation 3, business 2, persistence 1 (by top folder under src/), no
 * file imports (type-only or not) a file of a higher rank, and the file-level import graph of src/ has no cycle.
 *
 * Limits: dynamic `require`/`import()` is not followed; files outside the three folders (src/main.ts) are unranked.
 *
 * Usage: npx tsx experiments/puzzle-01/puzzles/p4-library-holds/oracle.ts <tree>
 */
import { importsOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../tools/oracle-lib';

const RANK: Record<string, number> = { presentation: 3, business: 2, persistence: 1 };
const rankOf = (rel: string): number | undefined => RANK[rel.split('/')[1] ?? ''];

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const evidence: string[] = [];
const graph = new Map<string, string[]>();
for (const rel of tree.files) {
  const edges: string[] = [];
  for (const imp of importsOf(tree.source(rel))) {
    const target = resolveRelative(rel, imp.spec);
    if (target === null || !tree.files.includes(target)) continue;
    edges.push(target);
    const from = rankOf(rel);
    const to = rankOf(target);
    if (from !== undefined && to !== undefined && to > from) evidence.push(`${rel}:${String(imp.line)} imports ${imp.spec} (upwards)`);
  }
  graph.set(rel, edges);
}
// Cycle search (depth-first, colour marking).
const colour = new Map<string, 'grey' | 'black'>();
const stack: string[] = [];
const dfs = (n: string): void => {
  colour.set(n, 'grey');
  stack.push(n);
  for (const m of graph.get(n) ?? []) {
    if (colour.get(m) === 'grey') evidence.push(`import cycle: ${[...stack.slice(stack.indexOf(m)), m].join(' -> ')}`);
    else if (colour.get(m) === undefined) dfs(m);
  }
  stack.pop();
  colour.set(n, 'black');
};
for (const f of tree.files) if (colour.get(f) === undefined) dfs(f);

const verdicts: SubGoalVerdict[] = [{ id: 'SG1', family: 'H7', pass: evidence.length === 0, evidence }];
process.exitCode = report('p4-library-holds', treeArg, verdicts);
