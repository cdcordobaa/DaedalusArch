/**
 * Command-line and environment wiring of the MCP prototype: flag parsing and the production `ServerContext`
 * (the real pipeline and Neo4j repository behind the injected ports). Kept apart from `main.ts` so importing it
 * does not start a server.
 */
import { createPipeline } from '../pipeline/pipeline-factory.js';
import { Neo4jRepository } from '../neo4j-ingestion/neo4j-repository.js';
import { createSpecLoader } from './tools.js';
import type { ServerContext } from './tools.js';

export interface McpArgs {
  readonly spec?: string;
  readonly project?: string;
}

/** `--spec <path>` and `--project <path>` (also `--flag=value`); unknown flags are ignored. Pure. */
export function parseArgs(argv: readonly string[]): McpArgs {
  const out: { spec?: string; project?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const [flag, inline] = arg.split('=', 2);
    const value = inline ?? argv[i + 1];
    if ((flag === '--spec' || flag === '--project') && value !== undefined && value !== '') {
      out[flag === '--spec' ? 'spec' : 'project'] = value;
      if (inline === undefined) i++;
    }
  }
  return out;
}

export function buildContext(args: McpArgs, env: NodeJS.ProcessEnv): ServerContext {
  return {
    defaultSpecPath: args.spec ?? env.DAEDALUS_SPEC,
    defaultProjectPath: args.project ?? env.DAEDALUS_PROJECT,
    env,
    loadSpec: createSpecLoader(),
    evaluateDeps: {
      makeGraph: (n) =>
        new Neo4jRepository({
          neo4jUri: n.uri,
          neo4jUser: n.user,
          neo4jPassword: n.password,
          apgStorePath: n.apgStorePath,
        }),
      makePipeline: createPipeline,
    },
  };
}
