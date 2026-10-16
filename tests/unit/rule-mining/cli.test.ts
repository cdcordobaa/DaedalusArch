/**
 * `firewall mine-rules` (src/cli/cli.ts): JSON output labelled as proposals, the proposed spec written with --out, and
 * argument errors.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main } from '../../../src/cli/cli.js';

const PROJECT = path.join(process.cwd(), 'tests/fixtures/v1.3-reference/layered/project');

async function run(args: string[]): Promise<{ out: string; err: string; code: number | undefined }> {
  let out = '';
  let err = '';
  const o = jest.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => { out += String(c); return true; });
  const e = jest.spyOn(process.stderr, 'write').mockImplementation((c: string | Uint8Array) => { err += String(c); return true; });
  process.exitCode = undefined;
  try {
    await main(['node', 'firewall', 'mine-rules', ...args]);
  } finally {
    o.mockRestore();
    e.mockRestore();
  }
  const code = process.exitCode as number | undefined;
  process.exitCode = undefined;
  return { out, err, code };
}

describe('firewall mine-rules', () => {
  it('prints the proposals as JSON and writes the proposed spec', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-cli-'));
    const spec = path.join(dir, 'proposed.yaml');
    const r = await run(['--project', PROJECT, '--format', 'json', '--out', spec]);
    expect(r.code).toBe(0);
    const json = JSON.parse(r.out) as { label: string; style: string; allowedDependencies: string[]; spec: { valid: boolean } };
    expect(json.label).toMatch(/^PROPOSED rules/);
    expect(json.style).toBe('layered');
    expect(json.allowedDependencies).toEqual(['business>persistence', 'presentation>business']);
    expect(json.spec.valid).toBe(true);
    expect(fs.readFileSync(spec, 'utf8')).toContain('PROPOSED rules');
    fs.rmSync(dir, { recursive: true, force: true });
  }, 120_000);

  it('rejects a confidence outside [0, 1]', async () => {
    const r = await run(['--project', PROJECT, '--min-confidence', '2']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/--min-confidence/);
  });
});
