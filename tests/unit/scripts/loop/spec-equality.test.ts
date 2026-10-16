/**
 * R23 (Docs/v1.3/study2-tunables.md §4): a plan that pins `specSha256` must have an evaluator spec and, for the
 * `daedalus-mcp` arm, an MCP server spec with that hash; the pin is required only when the caller asks. Made-up demo
 * tasks only; no model.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkSpecEquality, loadLoopPlan, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import type { LoopPlanFile } from '../../../../scripts/lib/loop/plan.js';
import { tmpRoot } from './helpers.js';

const REPO = process.cwd();
const SPEC = 'specs/clean-arch.yaml';
const SPEC_SHA = createHash('sha256').update(fs.readFileSync(path.join(REPO, SPEC))).digest('hex');

let tmp: string;
beforeEach(() => {
  tmp = tmpRoot();
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function plan(over: Partial<LoopPlanFile> = {}): LoopPlanFile {
  return {
    description: 'd',
    tasksFile: 'experiments/loop-demo/demo-tasks.json',
    adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }],
    arms: ['none', 'daedalus-mcp'],
    runs: 1,
    orderSeed: 7,
    outRoot: '/o',
    binary: '/b',
    harnessRoot: '/h',
    allowBash: true,
    daedalus: { nodeBinary: '/usr/bin/node', serverEntry: '/s/main.js', specPath: path.join(REPO, SPEC) },
    evaluatorSpec: SPEC,
    ...over,
  };
}

describe('checkSpecEquality', () => {
  it('without specSha256: no check, unless required for a daedalus-mcp plan', () => {
    expect(checkSpecEquality(plan(), REPO)).toEqual([]);
    expect(checkSpecEquality(plan(), REPO, { requireSpecSha256: true }).map((e) => e.code)).toEqual(['LOOP_PLAN_INVALID']);
    expect(checkSpecEquality(plan({ arms: ['none', 'gate'] }), REPO, { requireSpecSha256: true })).toEqual([]);
  });

  it('accepts matching evaluator and MCP specs', () => {
    expect(checkSpecEquality(plan({ specSha256: SPEC_SHA }), REPO, { requireSpecSha256: true })).toEqual([]);
  });

  it('refuses an MCP server spec that differs from the evaluator spec', () => {
    const other = path.join(tmp, 'other.yaml');
    fs.writeFileSync(other, `${fs.readFileSync(path.join(REPO, SPEC), 'utf8')}\n# edited\n`);
    const p = plan({ specSha256: SPEC_SHA, daedalus: { nodeBinary: '/usr/bin/node', serverEntry: '/s/main.js', specPath: other } });
    const errors = checkSpecEquality(p, REPO);
    expect(errors.map((e) => e.code)).toEqual(['LOOP_PLAN_SPEC_MISMATCH']);
    expect(errors[0]?.message).toContain('daedalus.specPath');
  });

  it('refuses a wrong pin on both files, and an unreadable server spec', () => {
    expect(checkSpecEquality(plan({ specSha256: 'a'.repeat(64) }), REPO).map((e) => e.code)).toEqual(['LOOP_PLAN_SPEC_MISMATCH', 'LOOP_PLAN_SPEC_MISMATCH']);
    const p = plan({ specSha256: SPEC_SHA, daedalus: { nodeBinary: '/usr/bin/node', serverEntry: '/s/main.js', specPath: path.join(tmp, 'missing.yaml') } });
    expect(checkSpecEquality(p, REPO).map((e) => e.code)).toEqual(['LOOP_FILE_UNREADABLE']);
  });

  it('validatePlan refuses a malformed specSha256', () => {
    expect(validatePlan({ ...plan(), specSha256: 'XYZ' }).success).toBe(false);
    expect(validatePlan({ ...plan(), specSha256: SPEC_SHA }).success).toBe(true);
  });

  it('loadLoopPlan applies the check', () => {
    const file = path.join(tmp, 'plan.json');
    const other = path.join(tmp, 'other.yaml');
    fs.writeFileSync(other, 'x: 1\n');
    fs.writeFileSync(file, JSON.stringify(plan({ specSha256: SPEC_SHA, daedalus: { nodeBinary: '/usr/bin/node', serverEntry: '/s/main.js', specPath: other } })));
    const r = loadLoopPlan(file, REPO);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.map((e) => e.code)).toEqual(['LOOP_PLAN_SPEC_MISMATCH']);
    fs.writeFileSync(file, JSON.stringify(plan({ specSha256: SPEC_SHA })));
    expect(loadLoopPlan(file, REPO, {}, { requireSpecSha256: true }).success).toBe(true);
  });
});
