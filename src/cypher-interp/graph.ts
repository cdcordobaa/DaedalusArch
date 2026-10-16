/**
 * The in-memory property graph the interpreter reads: nodes with labels and properties, typed directed
 * relationships with properties, label and adjacency indexes. Iteration order is creation order everywhere (label
 * scans, expansions); Neo4j's own order for a query without ORDER BY depends on its planner and store layout and is not
 * reproduced (Docs/v1.3/cypher-interpreter.md §5, trap T1).
 */
import type { GraphNode, GraphRel, Value } from './values.js';

export interface MutableNode extends GraphNode {
  readonly labels: Set<string>;
  readonly properties: Map<string, Value>;
}

export interface MutableRel extends GraphRel {
  readonly properties: Map<string, Value>;
}

export class MemoryGraph {
  private nextId = 0;
  private nodeList: MutableNode[] = [];
  private relList: MutableRel[] = [];
  private readonly byLabel = new Map<string, MutableNode[]>();
  private readonly outRels = new Map<GraphNode, MutableRel[]>();
  private readonly inRels = new Map<GraphNode, MutableRel[]>();

  get nodes(): readonly GraphNode[] {
    return this.nodeList;
  }

  get relationships(): readonly GraphRel[] {
    return this.relList;
  }

  nodesWithLabel(label: string): readonly GraphNode[] {
    return this.byLabel.get(label) ?? [];
  }

  outgoing(n: GraphNode): readonly GraphRel[] {
    return this.outRels.get(n) ?? [];
  }

  incoming(n: GraphNode): readonly GraphRel[] {
    return this.inRels.get(n) ?? [];
  }

  createNode(labels: readonly string[], properties: ReadonlyMap<string, Value>): GraphNode {
    const node: MutableNode = { kind: 'node', id: this.nextId++, labels: new Set(labels), properties: new Map(properties) };
    this.nodeList.push(node);
    for (const l of node.labels) {
      let list = this.byLabel.get(l);
      if (list === undefined) this.byLabel.set(l, (list = []));
      list.push(node);
    }
    return node;
  }

  createRelationship(type: string, start: GraphNode, end: GraphNode, properties: ReadonlyMap<string, Value>): GraphRel {
    const rel: MutableRel = { kind: 'rel', id: this.nextId++, type, start, end, properties: new Map(properties) };
    this.relList.push(rel);
    let o = this.outRels.get(start);
    if (o === undefined) this.outRels.set(start, (o = []));
    o.push(rel);
    let i = this.inRels.get(end);
    if (i === undefined) this.inRels.set(end, (i = []));
    i.push(rel);
    return rel;
  }

  clear(): void {
    this.nodeList = [];
    this.relList = [];
    this.byLabel.clear();
    this.outRels.clear();
    this.inRels.clear();
  }
}
