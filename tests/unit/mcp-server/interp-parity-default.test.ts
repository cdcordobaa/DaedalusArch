/**
 * Default path unchanged (Docs/v1.3/mcp-interp-parity.md §4.2): with no `--fast-rules-engine` flag and no
 * `DAEDALUS_FAST_RULES_ENGINE`, check_file, check_diff and check_import return exactly what untouched `origin/v1.3`
 * returned (golden file written by `interp-parity-capture.ts` there). An unknown engine value also stays on the fast path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { captureTools, REPO_ROOT } from './interp-parity-capture.js';

const GOLDEN = path.join(REPO_ROOT, 'tests/fixtures/mcp-interp-parity/default-golden.json');

describe('MCP fast-rules engine: default path', () => {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) as Record<string, unknown>;

  it('no flag, no environment: the tool outputs equal the origin/v1.3 golden capture', async () => {
    expect(await captureTools([], {})).toEqual(golden);
  });

  it('--fast-rules-engine fast equals the golden capture', async () => {
    expect(await captureTools(['--fast-rules-engine', 'fast'], {})).toEqual(golden);
  });

  it('an unknown engine value is ignored (fast path)', async () => {
    expect(await captureTools(['--fast-rules-engine=neo4j'], { DAEDALUS_FAST_RULES_ENGINE: 'bogus' })).toEqual(golden);
  });
});
