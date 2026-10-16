/**
 * Parity guard without a database (v1.3 npx mode, Docs/v1.3/npx-mode.md §4).
 *
 * The five C16 golden fixtures run through the real symbolic pipeline on the in-process Cypher interpreter
 * (`graphEngine: 'cypher-interp'`) and the normalised result must equal the committed golden snapshot byte for byte
 * (`tests/golden/__snapshots__/*.json`, written from Neo4j). Same pipeline config, normaliser and serialiser as the
 * Neo4j golden suite (`tests/golden/golden.test.ts`); only the repository differs. Never rewrites a snapshot.
 *
 * This is the light, CI-friendly guard; the heavy one is the live differential harness
 * (`scripts/v1.3/memory-parity.ts`, every statement against Neo4j 5.26.24).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import { GOLDEN_CASES } from '../../golden/golden-cases.js';
import { normaliseForSnapshot, serialiseSnapshot } from '../../golden/normalise.js';

const SNAPSHOT_DIR = path.resolve(__dirname, '../../golden/__snapshots__');

describe('cypher-interp reproduces the committed golden snapshots (no Neo4j)', () => {
  for (const c of GOLDEN_CASES) {
    it(c.id, async () => {
      const apgStorePath = fs.mkdtempSync(path.join(os.tmpdir(), `interp-golden-${c.id}-`));
      const config: PipelineConfig = {
        projectPath: c.projectPath,
        specFilePath: c.specPath,
        neo4jUri: '',
        neo4jUser: '',
        neo4jPassword: '',
        evaluationMode: 'symbolic-only',
        pipelineMode: 'stateless',
        persist: false,
        diff: false,
        verbose: false,
        apgStorePath,
        llmConfig: undefined,
        graphEngine: 'cypher-interp',
      };
      const bundle = createPipeline(config);
      try {
        const result = await bundle.executor.execute();
        if (!result.success) throw new Error(result.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
        const serialised = serialiseSnapshot(
          normaliseForSnapshot(c.id, { report: result.data, warnings: [...bundle.context.warnings] }),
        );
        const expected = fs.readFileSync(path.join(SNAPSHOT_DIR, `${c.id}.json`), 'utf8');
        expect(JSON.parse(serialised)).toEqual(JSON.parse(expected));
        expect(serialised).toBe(expected);
      } finally {
        await bundle.cleanup();
        fs.rmSync(apgStorePath, { recursive: true, force: true });
      }
    }, 120_000);
  }
});
