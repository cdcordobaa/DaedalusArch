/**
 * R23 (Docs/v1.3/post-merge-review-2026-10-16.md): in the daedalus-mcp arm the MCP server's spec and the evaluator's
 * spec must be the same rules, or the tool's advice and the score disagree. The live wiring checks the two files'
 * sha256 before any run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mcpSpecCheck } from '../../../../scripts/lib/loop/plan.js';
import { tmpRoot } from './helpers.js';

describe('R23: daedalus-mcp spec equals the evaluator spec', () => {
  const root = tmpRoot('mcp-spec-');
  const write = (rel: string, text: string): string => {
    const f = path.join(root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    return f;
  };
  const same = write('repo/specs/clean-arch.yaml', 'spec: 1\n');
  const copy = write('opt/daedalus/specs/clean-arch.yaml', 'spec: 1\n');
  const stale = write('opt/stale/clean-arch.yaml', 'spec: 0\n');
  const repo = path.join(root, 'repo');
  const plan = (specPath: string, arms: string[] = ['none', 'daedalus-mcp']) => ({ arms, evaluatorSpec: 'specs/clean-arch.yaml', daedalus: { nodeBinary: '/n', serverEntry: '/s', specPath } }) as never;

  it('accepts the same content under another path, and returns both hashes', () => {
    const r = mcpSpecCheck(plan(copy), repo);
    expect(r.success).toBe(true);
    if (r.success && r.data !== undefined) expect(r.data.mcpSpecSha256).toBe(r.data.evaluatorSpecSha256);
    expect(fs.readFileSync(same, 'utf8')).toBe('spec: 1\n');
  });

  it('refuses a different spec, and a missing one', () => {
    const r = mcpSpecCheck(plan(stale), repo);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('LOOP_PLAN_SPEC_MISMATCH');
    expect(mcpSpecCheck(plan(path.join(root, 'nope.yaml')), repo).success).toBe(false);
  });

  it('does nothing without the daedalus-mcp arm', () => {
    const r = mcpSpecCheck(plan(stale, ['none', 'gate']), repo);
    expect(r).toMatchObject({ success: true, data: undefined });
  });
});
