/**
 * Command-line and environment wiring of the MCP prototype: flag parsing and the production `ServerContext`
 * (the real pipeline and Neo4j repository behind the injected ports). Kept apart from `main.ts` so importing it
 * does not start a server.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPipeline } from '../pipeline/pipeline-factory.js';
import { Neo4jRepository } from '../neo4j-ingestion/neo4j-repository.js';
import { createSpecLoader } from './tools.js';
import type { ServerContext } from './tools.js';
import { buildNeuralService, parseNeuralArgs } from './neural-context.js';
import type { NeuralArgs } from './neural-context.js';

export interface McpArgs {
  readonly spec?: string;
  readonly project?: string;
  /** Neural arm flags (`--neural ...`); absent when no neural flag is given. */
  readonly neural?: NeuralArgs;
}

/**
 * `--spec <path>` and `--project <path>` (also `--flag=value`), plus the neural flags (`neural-context.ts`); unknown
 * flags are ignored. Pure.
 */
export function parseArgs(argv: readonly string[]): McpArgs {
  const out: { spec?: string; project?: string; neural?: NeuralArgs } = {};
  const neural = parseNeuralArgs(argv);
  if (neural !== undefined) out.neural = neural;
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

/**
 * The presets directory `infer_spec` reads: `DAEDALUS_PRESETS`, else `presets/` next to the package the entry runs
 * from (`<pkg>/dist/mcp-server/main.js` or `<pkg>/src/mcp-server/main.ts`), else `presets/` under the working directory.
 */
export function presetsDirFrom(env: NodeJS.ProcessEnv, entry: string | undefined, cwd: string): string | undefined {
  const candidates = [
    env.DAEDALUS_PRESETS,
    entry !== undefined ? path.resolve(path.dirname(entry), '..', '..', 'presets') : undefined,
    path.resolve(cwd, 'presets'),
  ].filter((c): c is string => c !== undefined && c !== '');
  return candidates.find((c) => fs.existsSync(c));
}

export function buildContext(args: McpArgs, env: NodeJS.ProcessEnv): ServerContext {
  // Off unless `--neural` or DAEDALUS_NEURAL names a provider: the default server is unchanged.
  const neural = buildNeuralService(args.neural ?? parseNeuralArgs([], env), env);
  return {
    ...(neural !== undefined ? { neural } : {}),
    presetsDir: presetsDirFrom(env, process.argv[1], process.cwd()),
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
