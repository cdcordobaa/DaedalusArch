/**
 * SCC fallback for cycle detection (C6 / C8; NFR-07, FR-35; U3 BR-U3-45; TF-11).
 *
 * Tarjan's algorithm over the File→File `IMPORTS|RE_EXPORTS` edges of an `APGResult`. Prepared
 * and off: `CYCLE_STRATEGY` stays `'cypher'` until the latency gate decides otherwise, and then
 * for the whole experiment (BR-U3-70 item 3). Nothing in the pipeline reads this module until
 * U3-R14 wires it behind the constant.
 *
 * Output contract (BR-U3-45): one violation per SCC of size ≥ 2, keyed on its smallest member
 * (`filePath`), discriminator `["scc"]`, no `target` (`""` in the id), evidence
 * `['cycle=<JSON>']` with the shortest cycle through the smallest member found by BFS that visits
 * neighbours in ascending `filePath` order. The cycle is closed (`[a, …, a]`) like the Cypher rows.
 */
import type { APGResult } from '../shared/types/apg.js';
import type { Dimension, Severity } from '../shared/types/enums.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import { functionId as makeFunctionId } from '../shared/types/value-objects.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import { getTemplateTag } from '../fitness-compiler/cypher-templates.js';
import { computeViolationId } from './violation-id.js';

export type CycleStrategy = 'cypher' | 'scc';

/** Frozen default (BR-U3-45, BR-U3-70 item 3); flipped only on the latency gate result. */
export const CYCLE_STRATEGY: CycleStrategy = 'cypher';

/** Literal discriminator value of SCC rows (T-MAP note 4; U5a selector `scc`). */
export const SCC_DISCRIMINATOR = 'scc';

const CYCLE_EDGE_TYPES: ReadonlySet<string> = new Set(['IMPORTS', 'RE_EXPORTS']);

export interface SccOptions {
  /** Glob patterns (FF-S02 `exclude_paths`); a file matching any of them is removed from the graph. */
  readonly excludePaths?: readonly string[];
}

export interface SccViolationOptions extends SccOptions {
  readonly functionId: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
}

/** File→File adjacency with sorted, de-duplicated neighbour lists. Self-loops are kept. */
export function buildFileGraph(apg: Pick<APGResult, 'nodes' | 'edges'>, options: SccOptions = {}): ReadonlyMap<string, readonly string[]> {
  const patterns = (options.excludePaths ?? []).map((glob) => new RegExp(globToRegex(glob)));
  const excluded = (filePath: string): boolean => patterns.some((re) => re.test(filePath));
  const fileOf = new Map<string, string>();
  for (const node of apg.nodes) {
    if (node.type === 'File' && !excluded(node.filePath)) fileOf.set(node.id, node.filePath);
  }
  const adjacency = new Map<string, Set<string>>();
  for (const filePath of fileOf.values()) adjacency.set(filePath, new Set());
  for (const edge of apg.edges) {
    if (!CYCLE_EDGE_TYPES.has(edge.type)) continue;
    const from = fileOf.get(edge.sourceId);
    const to = fileOf.get(edge.targetId);
    if (from === undefined || to === undefined) continue;
    adjacency.get(from)?.add(to);
  }
  const sorted = new Map<string, readonly string[]>();
  for (const filePath of [...adjacency.keys()].sort(compare)) {
    sorted.set(filePath, [...(adjacency.get(filePath) ?? [])].sort(compare));
  }
  return sorted;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Strongly connected components of size ≥ 2 (iterative Tarjan). Each component is sorted
 * ascending; components are ordered by their smallest member.
 */
export function stronglyConnectedComponents(graph: ReadonlyMap<string, readonly string[]>): readonly (readonly string[])[] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  for (const root of graph.keys()) {
    if (index.has(root)) continue;
    const work: { node: string; next: number }[] = [{ node: root, next: 0 }];
    index.set(root, counter);
    low.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame === undefined) break;
      const neighbours = graph.get(frame.node) ?? [];
      const next = neighbours[frame.next];
      if (next !== undefined) {
        frame.next++;
        if (!index.has(next)) {
          index.set(next, counter);
          low.set(next, counter);
          counter++;
          stack.push(next);
          onStack.add(next);
          work.push({ node: next, next: 0 });
        } else if (onStack.has(next)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, index.get(next) ?? 0));
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined) {
        low.set(parent.node, Math.min(low.get(parent.node) ?? 0, low.get(frame.node) ?? 0));
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let member: string | undefined;
        do {
          member = stack.pop();
          if (member === undefined) break;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.node);
        if (component.length >= 2) components.push(component.sort(compare));
      }
    }
  }
  return components.sort((a, b) => compare(a[0] ?? '', b[0] ?? ''));
}

/**
 * Shortest cycle through `start` inside `members`, by BFS visiting neighbours in ascending
 * `filePath` order; returned closed (`[start, …, start]`). The first node dequeued that has an
 * edge back to `start` closes the cycle, so ties are broken by the BFS order.
 */
export function representativeCycle(
  graph: ReadonlyMap<string, readonly string[]>,
  members: readonly string[],
  start: string,
): readonly string[] {
  const inside = new Set(members);
  const parent = new Map<string, string | null>([[start, null]]);
  const queue: string[] = [start];
  // for-of over an array visits elements appended during the loop (the BFS queue).
  for (const node of queue) {
    const neighbours = graph.get(node) ?? [];
    if (node !== start && neighbours.includes(start)) {
      const path: string[] = [];
      for (let at: string | null | undefined = node; typeof at === 'string'; at = parent.get(at)) path.push(at);
      return [...path.reverse(), start];
    }
    for (const next of neighbours) {
      if (!inside.has(next) || parent.has(next)) continue;
      parent.set(next, node);
      queue.push(next);
    }
  }
  return [start, start];
}

/** FF-S02 violations from the APG (template path; honours the function's `excludePaths`). */
export function findSccViolations(apg: Pick<APGResult, 'nodes' | 'edges'>, options: SccViolationOptions): readonly Violation[] {
  const graph = buildFileGraph(apg, options);
  const fid = makeFunctionId(options.functionId);
  const tag = getTemplateTag('no-cyclic-deps');
  return stronglyConnectedComponents(graph).map((component) => {
    const filePath = component[0] ?? '';
    const cycle = representativeCycle(graph, component, filePath);
    const violation: Violation = {
      id: computeViolationId({ functionId: fid, filePath, discriminator: [SCC_DISCRIMINATOR] }),
      type: 'CYCLIC_DEPENDENCY',
      dimension: options.dimension,
      severity: options.severity,
      functionId: fid,
      route: 'symbolic',
      filePath,
      message: `Circular dependency: ${cycle.join(',')}`,
      evidence: [`cycle=${JSON.stringify(cycle)}`],
      deterministic: true,
      discriminator: [SCC_DISCRIMINATOR],
      ...(tag !== undefined ? { tag } : {}),
    };
    return violation;
  });
}

/** `cyclicDependencyCount` on the SCC path: files in SCCs of size ≥ 2 (metric path: no exclusions). */
export function countSccFiles(apg: Pick<APGResult, 'nodes' | 'edges'>): number {
  return stronglyConnectedComponents(buildFileGraph(apg)).reduce((sum, component) => sum + component.length, 0);
}
