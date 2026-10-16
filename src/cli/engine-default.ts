/**
 * Graph-engine resolution of the commands that evaluate (v1.3 npx mode, Docs/v1.3/npx-mode.md §2).
 *
 * Order: an explicit `--engine` wins; else an explicit `--neo4j-uri` on the command line, or a non-empty `NEO4J_URI`
 * in the environment, selects `neo4j` (the reference engine); else `cypher-interp` (the in-process interpreter, no
 * server). Every resolution is announced on one stderr line, so a run never changes engine silently. Study and
 * experiment scripts pass `--engine neo4j` to their CLI children and never rely on this default.
 */
import { GRAPH_ENGINES, parseGraphEngine } from '../cypher-interp/engine.js';
import type { GraphEngine } from '../cypher-interp/engine.js';

export type EngineSource = 'flag' | 'neo4j-uri-flag' | 'neo4j-uri-env' | 'no-neo4j-uri';

export interface ResolvedEngine {
  readonly engine: GraphEngine;
  readonly source: EngineSource;
}

export interface EngineInputs {
  /** `--engine` value, undefined when not given. */
  readonly flag?: string | undefined;
  /** Whether `--neo4j-uri` was given on the command line. */
  readonly neo4jUriFlag?: boolean;
  readonly env: NodeJS.ProcessEnv;
}

/** The engine and why; `undefined` for an unknown `--engine` value. Pure. */
export function resolveEngine(inputs: EngineInputs): ResolvedEngine | undefined {
  if (inputs.flag !== undefined) {
    const engine = parseGraphEngine(inputs.flag);
    return engine === undefined ? undefined : { engine, source: 'flag' };
  }
  if (inputs.neo4jUriFlag === true) return { engine: 'neo4j', source: 'neo4j-uri-flag' };
  if ((inputs.env.NEO4J_URI ?? '') !== '') return { engine: 'neo4j', source: 'neo4j-uri-env' };
  return { engine: 'cypher-interp', source: 'no-neo4j-uri' };
}

const REASONS: Record<EngineSource, string> = {
  flag: '--engine',
  'neo4j-uri-flag': '--neo4j-uri given',
  'neo4j-uri-env': 'NEO4J_URI is set',
  'no-neo4j-uri': 'NEO4J_URI is not set; pass --engine neo4j for the reference engine',
};

/** The one stderr line naming the engine (no URI, no credential). */
export function engineLine(r: ResolvedEngine): string {
  const what = r.engine === 'neo4j' ? 'neo4j (reference engine)' : 'cypher-interp (in-process, no database)';
  return `daedalus: graph engine ${what} [${REASONS[r.source]}]\n`;
}

export const ENGINE_OPTION_HELP =
  `Graph engine: ${GRAPH_ENGINES.join(' | ')}. Default: neo4j when NEO4J_URI is set (or --neo4j-uri is given), ` +
  'else cypher-interp (in-process Cypher interpreter, no Neo4j server). Neo4j is the reference engine for reported numbers.';

/**
 * `resolveEngine` for a CLI action: prints the engine line (or the error), sets exit code 2 on an unknown value and
 * returns `undefined` so the action stops before building a pipeline.
 */
export function resolveEngineForCli(inputs: EngineInputs, write: (s: string) => void = (s) => process.stderr.write(s)): GraphEngine | undefined {
  const r = resolveEngine(inputs);
  if (r === undefined) {
    write(`Error: --engine must be one of ${GRAPH_ENGINES.join(' | ')}\n`);
    process.exitCode = 2;
    return undefined;
  }
  write(engineLine(r));
  return r.engine;
}
