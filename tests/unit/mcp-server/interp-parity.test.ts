/**
 * `--fast-rules-engine cypher-interp` (Docs/v1.3/mcp-interp-parity.md): the three #161 §3.7 tool defects as regression
 * tests on the hexagonal reference project, plus the option parsing and the spec-only fallback.
 */
import { buildContext, parseArgs } from '../../../src/mcp-server/context.js';
import { fastRulesEngineOf, NO_ROOT_NOTE, rowDelta } from '../../../src/mcp-server/interp-check.js';
import type { GraphRow } from '../../../src/mcp-server/interp-check.js';
import { checkDiffTool, checkFileTool, checkImportTool } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { captureDiff, HEX_PROJECT, HEX_SPEC, PROPOSED_SERVICE, SERVICE } from './interp-parity-capture.js';

jest.setTimeout(120_000);

const OUTBOUND_SPECIFIER = '../../adapters/outbound/persistence/InMemoryBookingRepository';

function interpCtx(project: string | null = HEX_PROJECT): ServerContext {
  return buildContext(parseArgs(['--spec', HEX_SPEC, '--fast-rules-engine', 'cypher-interp', ...(project !== null ? ['--project', project] : [])]), {});
}

function data<T>(r: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!r.ok) throw new Error(r.message);
  return r.data;
}

describe('fast-rules engine option', () => {
  it('flag wins over the environment; unknown values fall back to fast', () => {
    expect(fastRulesEngineOf(undefined, {})).toBe('fast');
    expect(fastRulesEngineOf(undefined, { DAEDALUS_FAST_RULES_ENGINE: 'cypher-interp' })).toBe('cypher-interp');
    expect(fastRulesEngineOf('fast', { DAEDALUS_FAST_RULES_ENGINE: 'cypher-interp' })).toBe('fast');
    expect(fastRulesEngineOf('neo4j', {})).toBe('fast');
    expect(parseArgs(['--fast-rules-engine=cypher-interp']).fastRulesEngine).toBe('cypher-interp');
    expect(parseArgs(['--spec', 's.yaml'])).toEqual({ spec: 's.yaml' });
  });

  it('the default context carries no engine and no evaluator', () => {
    const ctx = buildContext(parseArgs(['--spec', HEX_SPEC]), {});
    expect(ctx.fastRulesEngine).toBe(undefined);
    expect(ctx.interp).toBe(undefined);
  });

  it('rowDelta is a multiset difference on (rule, file, target)', () => {
    const row = (ruleId: string, file: string, target?: string): GraphRow => ({ ruleId, ruleName: ruleId, file, ...(target !== undefined ? { target } : {}), message: '', severity: 'major', type: 'LAYER_VIOLATION', blocking: true });
    const next = [row('FF-S01', 'a.ts', 'b.ts'), row('FF-S01', 'a.ts', 'b.ts'), row('FF-S02', 'a.ts')];
    expect(rowDelta(next, [row('FF-S01', 'a.ts', 'b.ts')]).map((r) => r.ruleId)).toEqual(['FF-S01', 'FF-S02']);
  });
});

describe('#161 §3.7 defects with --fast-rules-engine cypher-interp (hexagonal reference)', () => {
  const ctx = interpCtx();

  it('(1) check_import application -> adapters-outbound returns the graph verdict (FF-S01 blocking)', async () => {
    const res = data(await checkImportTool(ctx, { from: SERVICE, module: OUTBOUND_SPECIFIER }));
    expect(res.engine).toBe('cypher-interp');
    expect(res.blockingVerdict).toBe('block');
    expect(res.verdict).toBe('violation');
    expect(res.violations.filter((v) => v.tier === 'blocking').map((v) => v.ruleId).includes('FF-S01')).toBe(true);
  });

  it('(1b) an allowed edge (application -> domain) passes', async () => {
    const res = data(await checkImportTool(ctx, { from: SERVICE, module: '../../domain/model/Room' }));
    expect(res.blockingVerdict).toBe('pass');
    expect(res.verdict).toBe('allowed');
  });

  it('(2) check_file: verdict and blockingVerdict agree (one verdict object)', async () => {
    const res = data(await checkFileTool(ctx, { path: SERVICE, content: PROPOSED_SERVICE }));
    expect(res.engine).toBe('cypher-interp');
    expect(res.blockingVerdict).toBe('block');
    expect(res.verdict).toBe('violations');
    expect(res.violations.every((v) => v.tier === 'blocking')).toBe(true);
    expect(res.summary).toBe(res.blockingSummary);
    expect(res.findings.some((f) => f.ruleId === 'FF-S01' && f.tier === 'blocking')).toBe(true);
  });

  it('(3) check_diff: no advisory finding is listed as a violation; verdicts agree per file', async () => {
    const res = data(await checkDiffTool(ctx, { diff: captureDiff() }));
    expect(res.engine).toBe('cypher-interp');
    expect(res.blockingVerdict).toBe('block');
    for (const f of res.files) {
      expect(f.violations.every((v) => v.tier === 'blocking')).toBe(true);
      expect(f.verdict === 'violations').toBe(f.blockingVerdict === 'block');
    }
    const service = res.files.find((f) => f.path === SERVICE);
    expect(service?.findings.map((v) => v.ruleId).includes('FF-S01')).toBe(true);
  });

  it('without a project root the tools answer on the fast path and say so', async () => {
    const spec = interpCtx(null);
    const file = data(await checkFileTool(spec, { path: SERVICE, content: PROPOSED_SERVICE }));
    expect(file.engine).toBe(undefined);
    expect(file.notes.includes(NO_ROOT_NOTE)).toBe(true);
    const imp = data(await checkImportTool(spec, { from: SERVICE, module: OUTBOUND_SPECIFIER }));
    expect(imp.notes.includes(NO_ROOT_NOTE)).toBe(true);
  });
});
