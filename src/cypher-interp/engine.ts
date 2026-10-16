/** Graph engines of the repository layer (v1.3 spike): Neo4j stays the reference engine for every reported number. */
export const GRAPH_ENGINES = ['neo4j', 'cypher-interp'] as const;

export type GraphEngine = (typeof GRAPH_ENGINES)[number];

export function parseGraphEngine(value: string): GraphEngine | undefined {
  return (GRAPH_ENGINES as readonly string[]).includes(value) ? (value as GraphEngine) : undefined;
}
