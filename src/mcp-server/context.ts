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
import { fastRulesEngineOf, InterpEvaluator } from './interp-check.js';
import { buildNeuralService, parseNeuralArgs } from './neural-context.js';
import type { NeuralArgs } from './neural-context.js';
import { createInterpEvaluator } from './interp-evaluator.js';
import { fileCallLogger } from './call-log.js';
import { semanticFactsConfigOf } from './semantic-facts.js';
import { resolveEngine } from '../cli/engine-default.js';
import type { ResolvedEngine } from '../cli/engine-default.js';

export interface McpArgs {
  readonly spec?: string;
  readonly project?: string;
  /** `--fast-rules-engine fast|cypher-interp` (Docs/v1.3/mcp-interp-parity.md); absent = `DAEDALUS_FAST_RULES_ENGINE`, else `fast`. */
  readonly fastRulesEngine?: string;
  /** `--hints`: fix hints on by default in check_file, check_diff and explain_violation. */
  readonly hints?: boolean;
  /** Neural arm flags (`--neural ...`); absent when no neural flag is given. */
  readonly neural?: NeuralArgs;
  /** `--engine neo4j|cypher-interp`; absent = the NEO4J_URI default (`engine-default.ts`). */
  readonly engine?: string;
  /** `--rule-mining`: also register the opt-in `propose_rules` tool. */
  readonly ruleMining?: boolean;
  /** `--tsconfig <path>`: explicit tsconfig for `evaluate_project` extraction (ADR-032); absent = `DAEDALUS_TSCONFIG`. */
  readonly tsconfig?: string;
  /** `--call-log <abs path>` (Docs/v1.3/mcp-call-log.md); absent = off (DAEDALUS_CALL_LOG is read by `callLogPath`). */
  readonly callLog?: string;
  /** `--semantic-facts <dir>` (v1.4 U9): the A2 directory of the opt-in `semantic_facts` tool; absent = DAEDALUS_SEMANTIC_FACTS, else off. */
  readonly semanticFacts?: string;
  /** `--confine` (`confine.ts`): bound the `spec` and `project` tool arguments; absent = `DAEDALUS_CONFINE=1`, else off. */
  readonly confine?: boolean;
}

const FLAGS: Readonly<Record<string, 'spec' | 'project' | 'engine' | 'fastRulesEngine' | 'tsconfig' | 'callLog' | 'semanticFacts'>> = { '--spec': 'spec', '--project': 'project', '--engine': 'engine', '--fast-rules-engine': 'fastRulesEngine', '--tsconfig': 'tsconfig', '--call-log': 'callLog', '--semantic-facts': 'semanticFacts' };

/**
 * `--confine`, `--spec <path>`, `--project <path>`, `--engine <name>`, `--fast-rules-engine <name>`, `--tsconfig <path>`, `--call-log <path>` and `--semantic-facts <dir>` (also `--flag=value`), `--hints`,
 * `--rule-mining`, plus the neural flags (`neural-context.ts`); unknown flags are ignored. Pure.
 */
export function parseArgs(argv: readonly string[]): McpArgs {
  const out: { spec?: string; project?: string; engine?: string; fastRulesEngine?: string; tsconfig?: string; callLog?: string; semanticFacts?: string; hints?: boolean; neural?: NeuralArgs; ruleMining?: boolean; confine?: boolean } = {};
  const neural = parseNeuralArgs(argv);
  if (neural !== undefined) out.neural = neural;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--rule-mining') {
      out.ruleMining = true;
      continue;
    }
    if (arg === '--hints') {
      out.hints = true;
      continue;
    }
    if (arg === '--confine') {
      out.confine = true;
      continue;
    }
    const [flag, inline] = arg.split('=', 2);
    const value = inline ?? argv[i + 1];
    const key = flag === undefined ? undefined : FLAGS[flag];
    if (key !== undefined && value !== undefined && value !== '') {
      out[key] = value;
      if (inline === undefined) i++;
    }
  }
  return out;
}

/** The call log path: `--call-log`, else DAEDALUS_CALL_LOG; undefined = off. */
export function callLogPath(args: McpArgs, env: NodeJS.ProcessEnv): string | undefined {
  const p = args.callLog ?? env.DAEDALUS_CALL_LOG;
  return p === undefined || p === '' ? undefined : p;
}

/** The server's engine: `--engine`, else neo4j when NEO4J_URI is set, else cypher-interp. Undefined = unknown value. */
export function serverEngine(args: McpArgs, env: NodeJS.ProcessEnv): ResolvedEngine | undefined {
  return resolveEngine({ flag: args.engine, env });
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

/** The entry script with symlinks resolved (`node_modules/.bin/daedalus-mcp` → the package's dist). */
function realEntry(entry: string | undefined): string | undefined {
  if (entry === undefined || entry === '') return entry;
  try {
    return fs.realpathSync(entry);
  } catch {
    return entry;
  }
}

export function buildContext(args: McpArgs, env: NodeJS.ProcessEnv): ServerContext {
  const fastRulesEngine = fastRulesEngineOf(args.fastRulesEngine, env);
  const tsconfigPath = args.tsconfig ?? env.DAEDALUS_TSCONFIG;
  // Off unless `--neural` or DAEDALUS_NEURAL names a provider: the default server is unchanged.
  const neural = buildNeuralService(args.neural ?? parseNeuralArgs([], env), env);
  const graphEngine = serverEngine(args, env)?.engine ?? 'neo4j';
  const projectPath = args.project ?? env.DAEDALUS_PROJECT;
  // Off unless a call-log path is given; `main.ts` refuses a relative path or one inside the project first.
  const logPath = callLogPath(args, env);
  // Off unless `--semantic-facts <dir>` or DAEDALUS_SEMANTIC_FACTS: the default tool list is unchanged.
  const semanticFacts = semanticFactsConfigOf(args.semanticFacts, env);
  return {
    ...(fastRulesEngine === 'cypher-interp' && { fastRulesEngine, interp: new InterpEvaluator() }),
    ...(neural !== undefined ? { neural } : {}),
    ...(logPath !== undefined ? { callLog: fileCallLogger(logPath, projectPath) } : {}),
    graphEngine,
    presetsDir: presetsDirFrom(env, realEntry(process.argv[1]), process.cwd()),
    defaultSpecPath: args.spec ?? env.DAEDALUS_SPEC,
    defaultProjectPath: projectPath,
    ...(args.hints === true || env.DAEDALUS_HINTS === '1' ? { hints: true } : {}),
    ...(args.confine === true || env.DAEDALUS_CONFINE === '1' ? { confine: true } : {}),
    ruleMining: args.ruleMining === true || env.DAEDALUS_RULE_MINING === '1',
    ...(semanticFacts !== undefined ? { semanticFacts } : {}),
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
      graphEngine,
      ...(graphEngine === 'cypher-interp' && { interp: createInterpEvaluator() }),
      ...(tsconfigPath !== undefined && tsconfigPath !== '' && { tsconfigPath: path.resolve(tsconfigPath) }),
    },
  };
}
