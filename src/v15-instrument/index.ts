/**
 * v1.5 instrument (Stage 0, 2026-10-26), promoted from the exploratory prototypes:
 * - APG-V15 graph build: the frozen APG plus the DETECT-02 / GRAPH-SCALE facts (`graph.ts`, `facts.ts`, `spec.ts`,
 *   `import-types.ts`, `conventions.ts`);
 * - RULES-V15: the Cypher rules in `rules/` (R-D4, R-D5, R-D5S, R-D9, R-H5, R-INJ, R-RTX, R-XCTX; R-D5S is v1.5-only, C1), run on `cypher-interp`;
 * - `check_consistency` (R-D4, R-XCTX as messages an agent can act on) and the v1.5 MCP server (`mcp/`);
 * - the S3 ownership facts (`s3-ownership.ts`, deterministic part; the caller supplies the reader's answers);
 * - the edit gate (`edit-gate/`: hook settings, relay, hub, de-duplication and messages).
 *
 * The frozen v1.4 instrument (`v1.4-freeze-2026-10-20`) is not changed by this module and stays the default: the
 * `daedalus` CLI and `src/mcp-server/main.ts` are the v1.4 path. The v1.5 path is chosen explicitly, through this
 * module or `src/v15-instrument/mcp/main.ts` (`npm run mcp:v15`). Zero model calls anywhere in it.
 */
export { VERSION, PROTOTYPE_VERSION, buildGraph, loadRules, rulesDir, runTree, writeTsconfig } from './graph.js';
export type { BuildOptions, Finding, Rule, TreeResult } from './graph.js';
export type { CommandFact, Facts, FootprintWrite } from './facts.js';
export { DEFAULT_REPOSITORIES, findSpec, globMatch, loadSpec } from './spec.js';
export type { AggregateDecl, Allowance, ContextDecl, DetectSpec, Role } from './spec.js';
export { CONSISTENCY_RULES, checkConsistency, formatText } from './consistency.js';
export type { CheckOptions, ConsistencyFinding, ConsistencyResult } from './consistency.js';
export * as s3 from './s3-ownership.js';

/** The instruments the code base can run. `v1.4` is the frozen default; `v1.5` is opt-in. */
export const INSTRUMENTS = {
  'v1.4': { tag: 'v1.4-freeze-2026-10-20', mcpEntry: 'src/mcp-server/main.ts', default: true },
  'v1.5': { tag: null, mcpEntry: 'src/v15-instrument/mcp/main.ts', default: false },
} as const;
export type InstrumentId = keyof typeof INSTRUMENTS;

/** Reads the instrument choice (`DAEDALUS_INSTRUMENT`); anything other than `v1.5` keeps the frozen v1.4 path. */
export function selectedInstrument(env: NodeJS.ProcessEnv = process.env): InstrumentId {
  return env['DAEDALUS_INSTRUMENT'] === 'v1.5' ? 'v1.5' : 'v1.4';
}
