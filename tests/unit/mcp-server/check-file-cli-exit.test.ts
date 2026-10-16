/**
 * R21 (Docs/v1.3/post-merge-review-2026-10-16.md): the check-file CLI exit code must follow `blockingVerdict` (the v1.3
 * answer the tool contract says to act on), not the legacy `verdict`, which ignores the v1.3 fast-rule findings.
 */
import * as path from 'node:path';
import { checkFileCli } from '../../../src/mcp-server/check-file-cli.js';
import { buildContext } from '../../../src/mcp-server/context.js';
import { CLEAN_ARCH_SPEC, REPO } from './helpers.js';

const HEX = path.join(REPO, 'presets/hexagonal.yaml');

async function run(spec: string, file: string, content: string): Promise<{ code: number; json: { verdict: string; blockingVerdict: string } }> {
  let out = '';
  const code = await checkFileCli([file], buildContext({ spec }, {}), () => content, (s) => {
    out += s;
  });
  return { code, json: JSON.parse(out) as { verdict: string; blockingVerdict: string } };
}

describe('R21: check-file CLI exit code', () => {
  it('exits 1 when only the v1.3 fast rules block (legacy verdict clean)', async () => {
    const r = await run(HEX, 'src/domain/Room.ts', "import { Db } from '../adapters/outbound/Db';\nexport class Room {\n  constructor(readonly db: Db) {}\n}\n");
    expect(r.json).toMatchObject({ verdict: 'clean', blockingVerdict: 'block' });
    expect(r.code).toBe(1);
  });

  it('exits 0 on a clean file and 1 on a blocking import violation', async () => {
    expect((await run(CLEAN_ARCH_SPEC, 'src/domain/A.ts', 'export class A {}\n')).code).toBe(0);
    expect((await run(CLEAN_ARCH_SPEC, 'src/domain/A.ts', "import 'express';\n")).code).toBe(1);
  });
});
