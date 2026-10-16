/**
 * In-memory mirror of the ingested APG graph (Docs/v1.3/scale.md §3). It follows the writes the ingestion sends to
 * Neo4j (`clearGraph`, `nodeIngestCypher`, `edgeIngestCypher`), recognised by their exact text, and holds what the
 * accelerated queries read: every node's label and `filePath`, and the IMPORTS and RE_EXPORTS relationships with
 * their `line` and `viaReExport` properties. It is indexed by node id, by label and by relationship type.
 *
 * The mirror is trusted only while it provably equals the database:
 * - it starts `unknown` (the database may hold an older graph) and becomes `valid` on a successful `clearGraph`;
 * - every recognised write is applied only after Neo4j ran it, and its `nodesCreated` / `relationshipsCreated`
 *   counter must equal the mirror's own count, else the mirror is `invalid`;
 * - any other query that changes data (a non-zero data counter) makes it `invalid`;
 * - a node id that is not a string makes it `invalid`. An id written twice (overloaded methods share one) is kept as
 *   Neo4j keeps it: the edge MATCH binds every node with the id, so one edge row creates one relationship per pair.
 * An `invalid` or `unknown` mirror answers nothing: every query goes to Neo4j.
 */
import { edgeIngestCypher, nodeIngestCypher } from '../neo4j-ingestion/graph-ingester.js';

/** Relationship types the accelerated queries read. */
export const MIRRORED_REL_TYPES: ReadonlySet<string> = new Set(['IMPORTS', 'RE_EXPORTS']);

export interface MirrorRel {
  readonly type: string;
  readonly source: number;
  readonly target: number;
  /** The stored `line` property (absent = `undefined`). */
  readonly line: unknown;
  /** The stored `viaReExport` property (absent = `undefined`). */
  readonly viaReExport: unknown;
}

export type MirrorState = 'unknown' | 'valid' | 'invalid';

/** Counter keys that report a data change (schema counters such as `indexesAdded` do not). */
const DATA_COUNTERS = ['nodesCreated', 'nodesDeleted', 'relationshipsCreated', 'relationshipsDeleted', 'propertiesSet', 'labelsAdded', 'labelsRemoved'];

export function changesData(counters: Readonly<Record<string, number>>): boolean {
  return DATA_COUNTERS.some((k) => (counters[k] ?? 0) !== 0);
}

const NODE_WRITE_RE = /^\n {6}UNWIND \$batch AS node\n {6}CREATE \(n:APGNode:([A-Za-z_][A-Za-z0-9_]*)\)/;
const EDGE_WRITE_RE = /^\n {6}UNWIND \$batch AS edge\n[\s\S]*CREATE \(src\)-\[r:([A-Za-z_][A-Za-z0-9_]*)\]->\(tgt\)/;

export type RecognisedWrite = { readonly kind: 'nodes'; readonly label: string } | { readonly kind: 'edges'; readonly type: string };

/** The ingestion write this text is, byte for byte; `undefined` for any other text. */
export function recogniseWrite(cypher: string): RecognisedWrite | undefined {
  const n = NODE_WRITE_RE.exec(cypher);
  if (n?.[1] !== undefined && nodeIngestCypher(n[1]) === cypher) return { kind: 'nodes', label: n[1] };
  const e = EDGE_WRITE_RE.exec(cypher);
  if (e?.[1] !== undefined && edgeIngestCypher(e[1]) === cypher) return { kind: 'edges', type: e[1] };
  return undefined;
}

export class GraphMirror {
  private stateValue: MirrorState = 'unknown';
  /** Node label (the APG node type) by node index. */
  readonly labels: string[] = [];
  /** Stored `filePath` by node index (`null` when the property is absent). */
  readonly filePaths: unknown[] = [];
  private readonly byId = new Map<string, number[]>();
  /** IMPORTS and RE_EXPORTS relationships, in creation order. */
  readonly rels: MirrorRel[] = [];
  private version = 0;

  get state(): MirrorState {
    return this.stateValue;
  }

  /** Increases on every change, so derived indexes can be cached per version. */
  get revision(): number {
    return this.version;
  }

  get nodeCount(): number {
    return this.labels.length;
  }

  /** After `clearGraph`: empty and valid on success, invalid on failure. */
  reset(cleared: boolean): void {
    this.labels.length = 0;
    this.filePaths.length = 0;
    this.byId.clear();
    this.rels.length = 0;
    this.version += 1;
    this.stateValue = cleared ? 'valid' : 'invalid';
  }

  invalidate(): void {
    if (this.stateValue !== 'invalid') this.version += 1;
    this.stateValue = 'invalid';
  }

  /**
   * Applies a recognised write that Neo4j ran successfully, with its counters. A batch the mirror cannot model, or a
   * counter that disagrees with the mirror's own count, invalidates the mirror.
   */
  applyWrite(write: RecognisedWrite, params: Readonly<Record<string, unknown>> | undefined, counters: Readonly<Record<string, number>>): void {
    if (this.stateValue !== 'valid') return;
    const batch = params?.batch;
    if (!Array.isArray(batch)) {
      this.invalidate();
      return;
    }
    this.version += 1;
    if (write.kind === 'nodes') {
      for (const row of batch as unknown[]) {
        const props = row !== null && typeof row === 'object' ? (row as Record<string, unknown>) : undefined;
        const id = props?.id;
        if (typeof id !== 'string') {
          this.invalidate();
          return;
        }
        const same = this.byId.get(id);
        if (same === undefined) this.byId.set(id, [this.labels.length]);
        else same.push(this.labels.length);
        this.labels.push(write.label);
        const filePath = props?.filePath;
        this.filePaths.push(filePath === undefined ? null : filePath);
      }
      if ('nodesCreated' in counters && counters.nodesCreated !== batch.length) this.invalidate();
      return;
    }
    let created = 0;
    const mirrored = MIRRORED_REL_TYPES.has(write.type);
    for (const row of batch as unknown[]) {
      const edge = row !== null && typeof row === 'object' ? (row as Record<string, unknown>) : undefined;
      const sourceId = edge?.sourceId;
      const targetId = edge?.targetId;
      const sources = typeof sourceId === 'string' ? this.byId.get(sourceId) : undefined;
      const targets = typeof targetId === 'string' ? this.byId.get(targetId) : undefined;
      if (sources === undefined || targets === undefined) continue;
      created += sources.length * targets.length;
      if (!mirrored) continue;
      const rawProps = edge?.props;
      const props = rawProps !== null && typeof rawProps === 'object' ? (rawProps as Record<string, unknown>) : {};
      for (const source of sources) {
        for (const target of targets) {
          this.rels.push({ type: write.type, source, target, line: props.line, viaReExport: props.viaReExport });
        }
      }
    }
    if ('relationshipsCreated' in counters && counters.relationshipsCreated !== created) this.invalidate();
  }
}
