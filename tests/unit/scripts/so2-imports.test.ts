/**
 * ADR-021 item 8 (audit follow-up to SO2-1..5): the U6 SO2 scripts are measurement scripts, not U5b harness scripts.
 * `scripts/lib/so2.ts` (pure row builders) and `scripts/so2-metrics-cli.ts` stay inside the BR-U5b-55 limits plus
 * the C10 edge and node type lists. `scripts/so2-metrics.ts` has a recorded BR-U5b-55 exemption: `profile` needs a
 * direct driver session (`resultAvailableAfter`, `resultConsumedAfter`), and `arms` / `flows-to` measure the
 * extractor itself, so it imports C1, C2, C3, C4, C5 and C8 modules in-process. Each file has its own whitelist,
 * and any other import fails this test.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { disallowedImportsUnder } from './u5b/import-whitelist.js';
import type { ImportPolicy } from './u5b/import-whitelist.js';

const ROOT = resolve(__dirname, '../../..');

/** so2.ts and so2-metrics-cli.ts: scripts, node:*, and the C10 enum lists (EDGE_TYPES, NODE_TYPES). */
const SO2_LIB: ImportPolicy = {
  packages: new Set(),
  src: new Set(['src/shared/types/enums.ts']),
};

/** so2-metrics.ts: the measurement exemption (ADR-021 item 8). */
const SO2_MEASUREMENT: ImportPolicy = {
  packages: new Set(['neo4j-driver']),
  src: new Set([
    'src/apg-extractor/index.ts',                  // C1 extractAPG (arms, flows-to, profile)
    'src/apg-extractor/types.ts',                  // C1 GraphMode (type)
    'src/fitness-compiler/index.ts',               // C4 compileFunctions (the FF-S02 query of a spec)
    'src/fitness-compiler/cypher-templates.ts',    // MAX_CYCLE_LENGTH, CYCLE_ROW_CAP
    'src/neo4j-ingestion/fs-snapshot-store.ts',    // C2 ingestion (profile only)
    'src/neo4j-ingestion/index.ts',
    'src/neo4j-ingestion/neo4j-repository.ts',
    'src/scoring-engine/universal-metrics.ts',     // C8 UNIVERSAL_METRIC_QUERIES (the metric's Cypher)
    'src/spec-parser/index.ts',                    // C3 parseSpec
    'src/evaluation-engine/scc-cycles.ts',         // C5 SCC sizes (scc_components.csv)
  ]),
};

const FILES: readonly (readonly [string, ImportPolicy])[] = [
  ['scripts/lib/so2.ts', SO2_LIB],
  ['scripts/so2-metrics-cli.ts', SO2_LIB],
  ['scripts/so2-metrics.ts', SO2_MEASUREMENT],
];

describe('U6 SO2 script import whitelists (ADR-021 item 8; BR-U5b-55 exemption)', () => {
  it.each(FILES.map(([f, p]) => [f, p] as const))('%s imports only its whitelist', (file, policy) => {
    expect(disallowedImportsUnder(policy, file, readFileSync(join(ROOT, file), 'utf8'), ROOT)).toEqual([]);
  });

  it('the pure row builders import no extractor, database or scoring module', () => {
    const text = [
      "import { extractAPG } from '../../src/apg-extractor/index.js';",
      "import { UNIVERSAL_CYCLE_STAGE } from '../../src/scoring-engine/index.js';",
      "import neo4j from 'neo4j-driver';",
      "import { EDGE_TYPES } from '../../src/shared/types/enums.js';",
      "import { LATENCY_GATE_MS } from '../run-experiment.js';",
    ].join('\n');
    expect(disallowedImportsUnder(SO2_LIB, 'scripts/lib/so2.ts', text, ROOT)).toEqual([
      'scripts/lib/so2.ts: src/apg-extractor/index.ts',
      'scripts/lib/so2.ts: src/scoring-engine/index.ts',
      'scripts/lib/so2.ts: package neo4j-driver',
    ]);
  });

  it('the measurement script may not reach the LLM critic or the pipeline', () => {
    const text = "import { createPipeline } from '../src/pipeline/pipeline-factory.js';\nimport { assembleUnitSourceFromView } from '../src/llm-critic/source-context.js';";
    expect(disallowedImportsUnder(SO2_MEASUREMENT, 'scripts/so2-metrics.ts', text, ROOT)).toEqual([
      'scripts/so2-metrics.ts: src/pipeline/pipeline-factory.ts',
      'scripts/so2-metrics.ts: src/llm-critic/source-context.ts',
    ]);
  });
});
