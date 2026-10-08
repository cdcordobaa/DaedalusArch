/**
 * Expected resolution from the compiled spec (U5a plan Step 25; BR-U5a-14, 19, 20, 21, 22; D-U5a-14).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { siteCollateral } from '../../../../scripts/lib/mutation/collateral.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../../../../scripts/lib/mutation/cycles.js';
import {
  collateralContext,
  compiledThresholds,
  expectedBlock,
  isStyleDisabled,
  loadCompiledSpec,
  resolveKey,
  resolveTemplates,
} from '../../../../scripts/lib/mutation/expected.js';
import type { CompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { buildImportGraph, openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import type { MutationEdit, MutationOperator, MutationSite } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
jest.setTimeout(120_000);

let clean: CompiledSpec;
/** Declares only dependency-direction and no-cyclic-deps; since U3 (FF-P06) `specs/clean-arch.yaml` declares every template. */
let partial: CompiledSpec;
let scratch: string;
beforeAll(async () => {
  const r = await loadCompiledSpec(REPO, 'specs/clean-arch.yaml');
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  clean = r.data;
  const p = await loadCompiledSpec(REPO, 'tests/fixtures/u5a/no-domain/firewall.spec.yaml');
  if (!p.success) throw new Error(JSON.stringify(p.errors));
  partial = p.data;
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-expected-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') out.push(...walk(p));
    } else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const SITE: MutationSite = {
  filePath: 'src/domain/entities/Task.ts',
  line: 1,
  kind: 'import-edge',
  detail: { symbol: 'InMemoryTaskRepository', targetFile: 'src/infrastructure/repositories/InMemoryTaskRepository.ts' },
};
const EDIT: MutationEdit = {
  editedFiles: ['src/domain/entities/Task.ts'],
  createdFiles: [],
  lineShifts: [],
  newEdges: [{ source: SITE.filePath, target: SITE.detail.targetFile ?? '' }],
  keyAnchor: { line: 2, values: {} },
};

function op(over: Partial<MutationOperator>): MutationOperator {
  return {
    id: 'MO-T',
    role: 'positive',
    core: true,
    dimension: 'structural',
    expectedTemplates: [],
    operatorCollateral: [],
    coveredByTemplates: [],
    coverage: 'in',
    source: 'test',
    findSites: () => [],
    checkPreconditions: () => ({ ok: true }),
    apply: () => DomainResult.fail([{ code: 'T', message: 't' }]),
    plannedEdges: () => [],
    ...over,
  };
}

describe('static call form (BR-U5a-19)', () => {
  it('every compileFunctions( call under scripts/** takes compilerInputFromSpec(', () => {
    const offenders: string[] = [];
    let calls = 0;
    for (const file of walk(path.join(REPO, 'scripts'))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/compileFunctions\(/g)) {
        calls++;
        const after = text.slice(m.index + 'compileFunctions('.length);
        if (!/^\s*compilerInputFromSpec\(/.test(after)) offenders.push(path.relative(REPO, file));
      }
    }
    expect(calls).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});

describe('resolution on specs/clean-arch.yaml (BR-U5a-19, 21)', () => {
  it('records spec path, sha256, layers and the domain layer', () => {
    expect(clean.specPath).toBe('specs/clean-arch.yaml');
    expect(clean.specSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(clean.layers.map((l) => l.name)).toEqual(['domain', 'application', 'infrastructure']);
    expect(clean.layers[0]?.directories).toEqual(['src/domain/**']);
    expect(clean.domainLayer).toBe('domain');
    expect(MAX_CYCLE_LENGTH).toBe(10);
    expect(CYCLE_ROW_CAP).toBe(100);
  });

  it('MO-S01 templates → [FF-S01, FF-S04], dimension structural', () => {
    const r = resolveTemplates(clean, ['dependency-direction', 'no-domain-outward-dep']);
    expect(r).toEqual({ functionIds: ['FF-S01', 'FF-S04'], disabledFunctionIds: [], absentTemplates: [], dimension: 'structural' });
  });

  it('disabled template carries the C5 reason; undeclared template is absent', () => {
    const r = resolveTemplates(clean, ['no-layer-skip', 'domain-state-purity']);
    expect(r.functionIds).toEqual(['FF-P06']);
    expect(r.disabledFunctionIds).toEqual([{ functionId: 'FF-S03', reason: 'not applicable to style clean-architecture' }]);
    expect(r.absentTemplates).toEqual([]);
    const u = resolveTemplates(partial, ['domain-state-purity']);
    expect(u).toEqual({ functionIds: [], disabledFunctionIds: [], absentTemplates: ['domain-state-purity'], dimension: undefined });
    expect(isStyleDisabled(clean, ['no-layer-skip'])).toBe(true);
    expect(isStyleDisabled(clean, ['dependency-direction'])).toBe(false);
    expect(isStyleDisabled(clean, ['domain-state-purity'])).toBe(false);
  });

  it('metric thresholds come from the compiled functions', () => {
    const t = compiledThresholds(clean);
    expect([t['domain-stability'], t['module-fan-out'], t['component-instability'], t['max-fan-in']]).toEqual([0.3, 10, 0.8, 15]);
  });
});

describe('location rules (BR-U5a-20)', () => {
  it('site-line key with site-target target and relType default', () => {
    const k = resolveKey({ template: 'dependency-direction', filePath: 'site', target: 'site-target', discriminator: ['relType'], line: 'site-line' }, 'FF-S01', SITE, EDIT);
    expect(k.success && k.data).toEqual({
      functionId: 'FF-S01',
      filePath: 'src/domain/entities/Task.ts',
      target: 'src/infrastructure/repositories/InMemoryTaskRepository.ts',
      discriminator: ['IMPORTS'],
      lineRule: 'site-line',
      line: 2,
    });
  });

  it('none rule has no line; created file path; missing discriminator value fails', () => {
    const edit: MutationEdit = { ...EDIT, createdFiles: ['src/application/use-cases/OrphanHelper.ts'] };
    const k = resolveKey({ template: 'no-orphan-files', filePath: 'created', line: 'none' }, 'FF-C04', SITE, edit);
    expect(k.success && k.data).toEqual({ functionId: 'FF-C04', filePath: 'src/application/use-cases/OrphanHelper.ts', target: '', discriminator: [], lineRule: 'none' });
    const bad = resolveKey({ template: 'single-responsibility-proxy', filePath: 'site', discriminator: ['class'], line: 'site-line' }, 'FF-SO01', SITE, EDIT);
    expect(!bad.success && bad.errors[0]?.code).toBe('MUT_KEY_UNRESOLVED');
  });

  it('positive block: keys per enabled function, absent templates, dimension fallback; twin block is negative', () => {
    const positive = op({
      expectedTemplates: [
        { template: 'dependency-direction', filePath: 'site', target: 'site-target', discriminator: ['relType'], line: 'site-line' },
        { template: 'no-domain-outward-dep', filePath: 'site', target: 'site-target', discriminator: ['relType'], line: 'site-line' },
      ],
    });
    const b = expectedBlock(clean, positive, SITE, EDIT, []);
    if (!b.success) throw new Error(JSON.stringify(b.errors));
    expect(b.data.negative).toBeUndefined();
    expect(b.data.functionIds).toEqual(['FF-S01', 'FF-S04']);
    expect(b.data.keys.map((k) => k.functionId)).toEqual(['FF-S01', 'FF-S04']);

    const absent = op({ dimension: 'pattern', expectedTemplates: [{ template: 'domain-state-purity', filePath: 'site', line: 'site-line' }] });
    const a = expectedBlock(partial, absent, SITE, EDIT, []);
    expect(a.success && a.data).toMatchObject({ functionIds: [], absentTemplates: ['domain-state-purity'], dimension: 'pattern', keys: [] });

    const twin = op({ id: 'MO-Tn', role: 'twin', twinOf: 'MO-T' });
    const n = expectedBlock(clean, twin, SITE, EDIT, []);
    expect(n.success && n.data).toEqual({ negative: true, twinOf: 'MO-T', functionIds: [], keys: [], collateral: [], coverage: 'in' });
  });
});

describe('F-U5A-CYCLE collateral under the explicit strategy (BR-U5a-14 i; D-U5a-14)', () => {
  function graphs(): { base: ReturnType<typeof buildImportGraph>; mutant: ReturnType<typeof buildImportGraph> } {
    const dir = path.join(scratch, `cycle-${String(Math.random()).slice(2)}`);
    fs.cpSync(path.join(REPO, 'fixtures/correct-reference'), dir, { recursive: true });
    const base = buildImportGraph(openImportGraphProject(dir, 'tsconfig.json'), clean.layers);
    const task = path.join(dir, 'src/domain/entities/Task.ts');
    fs.writeFileSync(task, `import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';\n${fs.readFileSync(task, 'utf8')}export const ref = InMemoryTaskRepository;\n`);
    const mutant = buildImportGraph(openImportGraphProject(dir, 'tsconfig.json'), clean.layers);
    return { base, mutant };
  }

  it('simple-cycles: the two §2.4 FF-S02 keys; scc: one key', () => {
    const { base, mutant } = graphs();
    const simple = siteCollateral(base, mutant, EDIT, collateralContext(clean, 'simple-cycles', []));
    if (!simple.success) throw new Error(JSON.stringify(simple.errors));
    const cycles = simple.data.filter((c) => c.cause === 'cycle');
    expect(cycles.map((c) => c.key?.filePath)).toEqual([
      'src/domain/entities/Task.ts,src/infrastructure/repositories/InMemoryTaskRepository.ts,src/domain/entities/Task.ts',
      'src/domain/entities/Task.ts,src/infrastructure/repositories/InMemoryTaskRepository.ts,src/domain/repositories/ITaskRepository.ts,src/domain/entities/Task.ts',
    ]);
    expect(cycles.every((c) => c.functionId === 'FF-S02')).toBe(true);
    const scc = siteCollateral(base, mutant, EDIT, collateralContext(clean, 'scc', []));
    if (!scc.success) throw new Error(JSON.stringify(scc.errors));
    expect(scc.data.filter((c) => c.cause === 'cycle').map((c) => [c.key?.functionId, c.key?.filePath, c.key?.target, c.key?.discriminator])).toEqual([
      ['FF-S02', 'src/domain/entities/Task.ts', '', ['scc']],
    ]);
  });
});
