/**
 * MCP v2 check_diff (hunks, rebuilding a modified file from the project, the old/new delta, the three bases) and the
 * tool layer: check_import's tiers, get_architecture_spec's v1.3 fields, infer_spec, explain_finding, and the two new
 * tools over the in-memory MCP transport.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { applyHunks, checkDiff, parseUnifiedDiffWithHunks } from '../../../src/mcp-server/diff-check.js';
import { createServer } from '../../../src/mcp-server/server.js';
import {
  checkImportTool,
  createSpecLoader,
  explainFindingTool,
  getArchitectureSpec,
  inferSpecTool,
} from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { presetsDirFrom } from '../../../src/mcp-server/context.js';
import { REPO, loadSpec } from './helpers.js';

const REF = path.join(REPO, 'tests/fixtures/v1.3-reference');
const CLEAN_SPEC = path.join(REF, 'clean-architecture/spec.yaml');
const CLEAN_PROJECT = path.join(REF, 'clean-architecture/project');
let clean: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(CLEAN_SPEC);
});

function ctx(overrides: Partial<ServerContext> = {}): ServerContext {
  const refuse = (): never => {
    throw new Error('not used');
  };
  return {
    defaultSpecPath: CLEAN_SPEC,
    defaultProjectPath: CLEAN_PROJECT,
    env: {},
    loadSpec: createSpecLoader(),
    presetsDir: path.join(REPO, 'presets'),
    evaluateDeps: { makeGraph: refuse, makePipeline: refuse },
    ...overrides,
  };
}

function tmpProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v2-diff-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const OLD = "import { Loan } from '../entities/Loan';\n\nexport class LoanPolicy {\n  ok(): boolean {\n    return true;\n  }\n}\n";
const NEW = "import { Loan } from '../entities/Loan';\nimport { SystemClock } from '../../infrastructure/system/SystemClock';\n\nexport class LoanPolicy {\n  constructor(private readonly clock: SystemClock) {}\n  ok(): boolean {\n    return true;\n  }\n}\n";
const DIFF = [
  '--- a/src/domain/services/LoanPolicy.ts',
  '+++ b/src/domain/services/LoanPolicy.ts',
  '@@ -1,4 +1,6 @@',
  " import { Loan } from '../entities/Loan';",
  "+import { SystemClock } from '../../infrastructure/system/SystemClock';",
  ' ',
  ' export class LoanPolicy {',
  '+  constructor(private readonly clock: SystemClock) {}',
  '   ok(): boolean {',
  '',
].join('\n');

describe('unified diff hunks', () => {
  it('keeps each hunk with its positions; applies forward and in reverse; refuses a hunk that does not fit', () => {
    const [f] = parseUnifiedDiffWithHunks(DIFF);
    expect(f?.hunks).toEqual([{ oldStart: 1, newStart: 1, lines: [" import { Loan } from '../entities/Loan';", "+import { SystemClock } from '../../infrastructure/system/SystemClock';", ' ', ' export class LoanPolicy {', '+  constructor(private readonly clock: SystemClock) {}', '   ok(): boolean {'] }]);
    const hunks = f?.hunks ?? [];
    expect(applyHunks(OLD, hunks, 'forward')).toBe(NEW);
    expect(applyHunks(NEW, hunks, 'reverse')).toBe(OLD);
    expect(applyHunks('something else\n', hunks, 'forward')).toBeUndefined();
  });

  it('applies a pure insertion after a given line', () => {
    const [f] = parseUnifiedDiffWithHunks('--- a/x.ts\n+++ b/x.ts\n@@ -2,0 +3 @@\n+c\n');
    expect(applyHunks('a\nb\nd\n', f?.hunks ?? [], 'forward')).toBe('a\nb\nc\nd\n');
  });
});

describe('check_diff (MCP v2)', () => {
  it('with a project root holding either side, rebuilds the file and reports the delta (before and after writing)', () => {
    for (const side of [OLD, NEW]) {
      const root = tmpProject({ 'src/domain/services/LoanPolicy.ts': side, 'src/infrastructure/system/SystemClock.ts': 'export class SystemClock {}\n' });
      try {
        const res = checkDiff(clean, DIFF, { projectRoot: root });
        expect(res.files[0]?.basis).toBe('delta');
        expect(res.blockingVerdict).toBe('block');
        expect(res.files[0]?.findings.map((v) => [v.ruleId, v.line, v.tier])).toEqual([
          ['FF-S01', 2, 'blocking'],
          ['FF-S04', 2, 'blocking'],
          ['FF-P06', 5, 'blocking'],
        ]);
        expect(res.files[0]?.notes).toContain('rebuilt from the diff and the project: findings are those the new content has and the old did not');
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('without a project root, checks the added lines (FF-P06 needs the class around the parameter)', () => {
    const res = checkDiff(clean, DIFF);
    expect(res.files[0]?.basis).toBe('added-lines');
    expect(res.files[0]?.findings.map((v) => v.ruleId)).toEqual(['FF-S01', 'FF-S04']);
    expect(res.blockingSummary).toMatch(/^BLOCK: 2 blocking violation\(s\) of FF-S01, FF-S04/);
  });

  it('does not re-report what the old content already had', () => {
    const before = "import { X } from '../../infrastructure/X';\nexport class P {}\n";
    const root = tmpProject({ 'src/domain/P.ts': before });
    try {
      const diff = "--- a/src/domain/P.ts\n+++ b/src/domain/P.ts\n@@ -1,2 +1,3 @@\n import { X } from '../../infrastructure/X';\n export class P {}\n+export const n = 1;\n";
      const res = checkDiff(clean, diff, { projectRoot: root });
      expect(res.files[0]?.basis).toBe('delta');
      expect(res.blockingVerdict).toBe('pass');
      expect(res.files[0]?.findings).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('checks an added file whole, with hints, and passes a clean change', () => {
    const add = "--- /dev/null\n+++ b/src/application/use-cases/Now.ts\n@@ -0,0 +1,3 @@\n+export class Now {\n+  at(): number { return Date.now(); }\n+}\n";
    const res = checkDiff(clean, add, { projectRoot: CLEAN_PROJECT });
    expect(res.files[0]?.basis).toBe('whole-file');
    expect(res.blockingVerdict).toBe('pass');
    expect(res.files[0]?.hints.map((h) => h.ruleId)).toEqual(['APG2.nondeterminism-in-core']);
    expect(res.blockingSummary).toBe('PASS: no blocking violation (v1.3 tiers); 0 advisory, 1 hint(s).');
  });
});

describe('tool layer (MCP v2 fields)', () => {
  it('check_import adds tier, construct, source and the blocking answer', async () => {
    const res = await checkImportTool(ctx(), { from: 'src/domain/entities/Loan.ts', module: '../../infrastructure/system/SystemClock' });
    if (!res.ok) throw new Error(res.message);
    expect(res.data.blockingVerdict).toBe('block');
    expect(res.data.violations.map((v) => [v.ruleId, v.tier])).toEqual([['FF-S01', 'blocking'], ['FF-S04', 'blocking']]);
    expect(res.data.violations[0]?.source).toMatch(/Martin, \*Clean Architecture\* \(2017\), ch\. 22/);
  });

  it('get_architecture_spec adds the v1.3 status, tier, construct, source and fast-path coverage per rule', async () => {
    const res = await getArchitectureSpec(ctx({ defaultSpecPath: path.join(REF, 'layered/spec.yaml') }), {});
    if (!res.ok) throw new Error(res.message);
    const p06 = res.data.rules.find((r) => r.id === 'FF-P06');
    expect(p06).toMatchObject({ status: 'active', v13Status: 'not-applicable', tier: 'blocking' });
    expect(res.data.rules.find((r) => r.id === 'FF-S03')).toMatchObject({ tier: 'blocking', checkedByFastPath: true, edgeView: 'literal' });
    expect(res.data.rules.find((r) => r.id === 'FF-C01')).toMatchObject({ tier: 'advisory', checkedByFastPath: false });
  });

  it('infer_spec proposes a spec with confidence and evidence, and never writes to the project', async () => {
    const before = fs.readdirSync(CLEAN_PROJECT).sort();
    const res = await inferSpecTool(ctx(), {});
    if (!res.ok) throw new Error(res.message);
    expect(res.data).toMatchObject({ status: 'proposed', style: 'clean-architecture', styleSource: 'classified', lowConfidence: false });
    expect(res.data.confidence).toBeGreaterThan(0.5);
    expect(res.data.ranked[0]?.evidence.length).toBeGreaterThan(0);
    expect(res.data.validation.valid).toBe(true);
    expect(res.data.specYaml).toMatch(/style: clean-architecture/);
    expect(res.data.review[0]).toMatch(/proposal/);
    expect(fs.readdirSync(CLEAN_PROJECT).sort()).toEqual(before);
    const forced = await inferSpecTool(ctx(), { style: 'layered' });
    expect(forced.ok && forced.data.styleSource).toBe('forced');
  });

  it('infer_spec fails clearly without a project, presets or a known style', async () => {
    expect(await inferSpecTool(ctx({ defaultProjectPath: undefined }), {})).toMatchObject({ ok: false });
    expect(await inferSpecTool(ctx({ presetsDir: undefined }), {})).toMatchObject({ ok: false, message: expect.stringMatching(/DAEDALUS_PRESETS/) as unknown });
    expect(await inferSpecTool(ctx(), { style: 'mvc' })).toMatchObject({ ok: false, message: expect.stringMatching(/Unknown style/) as unknown });
    expect(await inferSpecTool(ctx(), { project: path.join(REPO, 'Docs') })).toMatchObject({ ok: false, message: expect.stringMatching(/has no src/) as unknown });
  });

  it('explain_finding: construct, literature, example and how it is checked, with the source line of the location', async () => {
    const res = await explainFindingTool(ctx(), { rule: 'FF-P06', location: 'src/domain/services/LoanPolicy.ts:6' });
    if (!res.ok) throw new Error(res.message);
    expect(res.data).toMatchObject({ ruleId: 'FF-P06', ruleName: 'domain-state-purity', tier: 'blocking' });
    expect(res.data.example.compliant).toMatch(/Clock/);
    expect(res.data.howChecked).toMatchObject({ edgeView: 'none', checkedByFastPath: true });
    expect(res.data.howChecked.fastPath).toMatch(/FLOWS_TO \(field\) half is N\/A/);
    expect(res.data.location).toMatchObject({ file: 'src/domain/services/LoanPolicy.ts', line: 6, layer: 'domain' });
    expect(typeof res.data.location?.text).toBe('string');
    const metric = await explainFindingTool(ctx(), { rule: 'FF-C01' });
    expect(metric.ok && metric.data.howChecked.checkedByFastPath).toBe(false);
    const hint = await explainFindingTool(ctx(), { rule: 'APG2.boundary-type-leak' });
    expect(hint.ok && hint.data).toMatchObject({ tier: 'advisory', tierSource: 'hint', candidateTier: 'blocking' });
    const byType = await explainFindingTool(ctx(), { rule: 'LAYER_VIOLATION' });
    expect(byType.ok && byType.data.ruleId).toBe('FF-S01');
    expect(await explainFindingTool(ctx(), { rule: 'no-such-rule' })).toMatchObject({ ok: false });
  });

  it('explain_finding knows the hexagonal and DDD templates by their spec ids', async () => {
    const res = await explainFindingTool(ctx({ defaultSpecPath: path.join(REPO, 'presets/ddd.yaml'), defaultProjectPath: path.join(REF, 'ddd/clean') }), { rule: 'FF-DT01' });
    if (!res.ok) throw new Error(res.message);
    expect(res.data).toMatchObject({ ruleName: 'aggregate-boundary', tier: 'blocking', literature: { row: 'style' } });
    expect(res.data.detects).toMatch(/inner entities/);
  });

  it('presetsDirFrom: env first, then next to the entry, then the working directory', () => {
    expect(presetsDirFrom({ DAEDALUS_PRESETS: path.join(REPO, 'presets') }, undefined, '/')).toBe(path.join(REPO, 'presets'));
    expect(presetsDirFrom({}, path.join(REPO, 'dist/mcp-server/main.js'), '/')).toBe(path.join(REPO, 'presets'));
    expect(presetsDirFrom({}, undefined, REPO)).toBe(path.join(REPO, 'presets'));
    expect(presetsDirFrom({}, '/nowhere/x/y.js', '/nowhere')).toBeUndefined();
  });

  it('serves infer_spec and explain_finding over MCP', async () => {
    const server = createServer(ctx());
    const client = new Client({ name: 'test', version: '0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    try {
      const ex = await client.callTool({ name: 'explain_finding', arguments: { rule: 'FF-S01', location: 'src/domain/entities/Loan.ts:1' } });
      expect((ex.structuredContent as { tier?: string } | undefined)?.tier).toBe('blocking');
      const inf = await client.callTool({ name: 'infer_spec', arguments: {} });
      expect((inf.structuredContent as { status?: string } | undefined)?.status).toBe('proposed');
      const bad = await client.callTool({ name: 'explain_finding', arguments: { rule: 'nope' } });
      expect(bad.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
