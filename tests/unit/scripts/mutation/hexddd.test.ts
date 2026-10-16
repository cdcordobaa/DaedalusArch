/**
 * v1.3 DRAFT hexagonal and DDD operators (`Docs/v1.3/operator-catalogue-hexddd.md`). The registry is checked against
 * the catalogue table; the run helpers (`scripts/v1.3/lib/operators-hexddd.ts`) on hand-made rows; and every entry is
 * applied on the clean hexagonal or DDD reference project (materialised into a temporary directory), where it must
 * find an eligible site and its mutant must type-check with the repository's tsc (BR-U5a-07). No Neo4j: detection is
 * measured by `scripts/v1.3/operators-hexddd-run.ts` (Docs/DiagnosticRuns/v1.3-operators-hexddd-2026-10-16.md).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PRECONDITION_REASONS } from '../../../../scripts/lib/mutation/catalogue-parser.js';
import { ALL_REASONS, ALL_SITE_KINDS, HEXDDD_REASONS, HEXDDD_SITE_KINDS } from '../../../../scripts/lib/mutation/hexddd/types.js';
import { loadCompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { HEXDDD_CATALOGUE_PATH, HEXDDD_OPERATORS, buildHexDddRegistry, isHexDddId, loadHexDddRegistry, positiveIdOf, stylesOf } from '../../../../scripts/lib/mutation/hexddd/index.js';
import { repositoryNames } from '../../../../scripts/lib/mutation/hexddd/ddd.js';
import { kebab } from '../../../../scripts/lib/mutation/hexddd/common.js';
import { openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import { ANTIPATTERN_OPERATORS } from '../../../../scripts/lib/mutation/antipatterns/index.js';
import { CATALOGUE_OPERATORS } from '../../../../scripts/lib/mutation/operators/index.js';
import { catalogueVersionOf } from '../../../../scripts/lib/mutation/registry.js';
import { mulberry32 } from '../../../../scripts/lib/mutation/rng.js';
import { evaluatePreconditions, sortSites } from '../../../../scripts/lib/mutation/sites.js';
import { provisionStubs } from '../../../../scripts/lib/mutation/stubs.js';
import { SITE_KINDS } from '../../../../scripts/lib/mutation/types.js';
import type { MutationEdit, MutationOperator, MutationSite } from '../../../../scripts/lib/mutation/types.js';
import { contextOf, copyProject, typecheck } from '../../../../scripts/v1.3/operators-hexddd-run.js';
import type { Base } from '../../../../scripts/v1.3/operators-hexddd-run.js';
import { expectedKeys, matchesKey, newViolations, seedOf, summarise } from '../../../../scripts/v1.3/lib/operators-hexddd.js';
import type { RunRow } from '../../../../scripts/v1.3/lib/operators-hexddd.js';
import { materialiseVariant } from '../../../../scripts/v1.3/lib/materialise.js';
import { loadReference } from '../../../../scripts/v1.3/lib/reference-model.js';

jest.setTimeout(900_000);

const REPO = path.resolve(__dirname, '../../../..');
const TSC = path.join(REPO, 'node_modules/typescript/lib/tsc.js');

describe('registry and DRAFT catalogue', () => {
  const text = fs.readFileSync(path.join(REPO, HEXDDD_CATALOGUE_PATH), 'utf8');

  /**
   * The entry table, read here rather than by the frozen `parseCatalogue` (its closed site-kind and reason enums are
   * hash-frozen and do not list the hexddd values, `hexddd/types.ts`). Same cell rules: backticks stripped, list cells
   * comma-separated, `—` for an empty list.
   */
  function entryTable(markdown: string): Record<string, string>[] {
    const lines = markdown.split('\n');
    const head = lines.findIndex((l) => l.startsWith('| Id | Core | Dimension |'));
    const cols = (l: string): string[] => l.slice(1, -1).split(' | ').map((c) => c.trim().replace(/`/g, ''));
    const names = cols(lines[head] ?? '');
    const rows: Record<string, string>[] = [];
    for (const l of lines.slice(head + 2)) {
      if (!l.startsWith('| MO-')) break;
      const cells = cols(l);
      expect(cells).toHaveLength(names.length);
      rows.push(Object.fromEntries(names.map((n, i) => [n, cells[i] ?? ''])));
    }
    return rows;
  }
  const list = (cell: string): string[] => (cell === '—' || cell === '' ? [] : cell.split(',').map((x) => x.trim()));

  it('25 entries, one to one with the registry on id, twin, dimension, expected templates, coverage and source', () => {
    const rows = entryTable(text);
    expect(rows.map((r) => r.Id)).toEqual(HEXDDD_OPERATORS.map((o) => o.id));
    for (const r of rows) {
      const op = HEXDDD_OPERATORS.find((o) => o.id === r.Id);
      if (op === undefined) throw new Error(r.Id);
      expect([r.Twin, r.Dimension, list(r['Expected templates'] ?? ''), r.Coverage, r.Source, r.Core]).toEqual([
        op.twinOf ?? `${op.id}n`,
        op.dimension,
        op.expectedTemplates.map((t) => t.template),
        op.coverage,
        op.source,
        'extension',
      ]);
      for (const k of list(r['Site kinds'] ?? '')) expect(ALL_SITE_KINDS).toContain(k);
      for (const k of list(r.Preconditions ?? '')) expect(ALL_REASONS).toContain(k);
    }
  });

  it('leaves the frozen enums alone: the hexddd kinds and reasons are not in types.ts or the catalogue parser', () => {
    for (const k of HEXDDD_SITE_KINDS) expect(SITE_KINDS as readonly string[]).not.toContain(k);
    for (const r of HEXDDD_REASONS) expect(PRECONDITION_REASONS as readonly string[]).not.toContain(r);
  });

  it('12 positives, 13 twins; every twin names a positive; every positive has a style', () => {
    const positives = HEXDDD_OPERATORS.filter((o) => o.role === 'positive');
    expect(positives).toHaveLength(12);
    expect(HEXDDD_OPERATORS.filter((o) => o.role === 'twin')).toHaveLength(13);
    for (const op of HEXDDD_OPERATORS) {
      expect(isHexDddId(op.id)).toBe(true);
      if (op.role === 'twin') expect(positives.some((p) => p.id === op.twinOf)).toBe(true);
      expect(stylesOf(op).length).toBeGreaterThan(0);
      expect(op.expectedTemplates.length > 0).toBe(op.role === 'positive');
    }
  });

  it('the registry carries this catalogue sha256 and shares no id with the frozen or anti-pattern catalogues', () => {
    const r = loadHexDddRegistry(REPO);
    if (!r.success) throw new Error(r.errors[0]?.message);
    expect(r.data.catalogueVersion).toBe(catalogueVersionOf(fs.readFileSync(path.join(REPO, HEXDDD_CATALOGUE_PATH))));
    expect(r.data.isFrozen).toBe(true);
    const others = new Set([...CATALOGUE_OPERATORS, ...ANTIPATTERN_OPERATORS].map((o) => o.id));
    for (const op of HEXDDD_OPERATORS) expect(others.has(op.id)).toBe(false);
    expect(() => buildHexDddRegistry('0'.repeat(64))).not.toThrow();
  });
});

describe('run helpers', () => {
  const site: MutationSite = { filePath: 'src/domain/A.ts', line: 1, kind: 'import-edge', detail: { targetFile: 'src/adapters/outbound/B.ts', symbol: 'B', class: 'A' } };
  const edit: MutationEdit = { editedFiles: ['src/domain/A.ts'], createdFiles: [], lineShifts: [], newEdges: [] };
  const op = HEXDDD_OPERATORS.find((o) => o.id === 'MO-H01') as MutationOperator;

  it('expected keys resolve templates to the spec ids; absent templates are listed', () => {
    const r = expectedKeys(op, site, edit, new Map([['dependency-direction-graph', ['FF-S01']]]));
    expect(r.keys).toEqual([{ template: 'dependency-direction-graph', functionId: 'FF-S01', filePath: 'src/domain/A.ts', target: 'src/adapters/outbound/B.ts' }]);
    expect(r.absent).toEqual(['core-isolation']);
    const skipped = expectedKeys(op, { ...site, detail: { ...site.detail, notExpected: 'core-isolation' } }, edit, new Map([['core-isolation', ['FF-S04']]]));
    expect(skipped).toEqual({ keys: [], absent: ['dependency-direction-graph'] });
  });

  it('new violations ignore lines; keys match on id, file, target, class and cycle membership', () => {
    const base = [{ functionId: 'FF-S01', filePath: 'x', target: 'y', discriminator: ['IMPORTS'] }];
    const mutant = [{ ...base[0], line: 9 }, { functionId: 'FF-S01', filePath: 'src/domain/A.ts', target: 'src/adapters/outbound/B.ts', discriminator: ['IMPORTS'] }] as never[];
    const fresh = newViolations(base, mutant);
    expect(fresh).toHaveLength(1);
    expect(matchesKey(fresh[0] as never, { template: 't', functionId: 'FF-S01', filePath: 'src/domain/A.ts', target: 'src/adapters/outbound/B.ts' })).toBe(true);
    expect(matchesKey(fresh[0] as never, { template: 't', functionId: 'FF-S04', filePath: 'src/domain/A.ts' })).toBe(false);
    expect(matchesKey({ functionId: 'FF-P03', filePath: 'f', target: '', discriminator: ['Repo'] }, { template: 't', functionId: 'FF-P03', filePath: 'f', discriminatorHas: 'Other' })).toBe(false);
    expect(matchesKey({ functionId: 'FF-S02', filePath: 'a,b,a', target: 'b' }, { template: 'no-cyclic-deps', functionId: 'FF-S02', filePath: 'b', target: 'a', cycle: true })).toBe(true);
  });

  it('summarise: recall for positives, false-fire rate for twins, with Wilson intervals', () => {
    const row = (operatorId: string, role: 'positive' | 'twin', status: RunRow['status']): RunRow => ({
      rowId: `${operatorId}-${status}`, operatorId, positiveId: 'MO-H01', role, baseId: 'b', baseKind: 'reference', style: 'hexagonal', site, status,
      expected: [], absentTemplates: [], hits: [], newBlocking: [], newAdvisory: [], typecheckErrors: [], editedFiles: [], createdFiles: [], stubs: [], diff: '',
    });
    const cells = ['MO-H01', 'MO-H01n'].map((operatorId) => ({ baseId: 'b', style: 'hexagonal', operatorId, candidates: 3, eligible: 2, sampled: 2, rejected: {} }));
    const s = summarise([row('MO-H01', 'positive', 'detected'), row('MO-H01', 'positive', 'typecheck'), row('MO-H01n', 'twin', 'silent')], cells, HEXDDD_OPERATORS.slice(0, 2));
    expect(s.map((x) => [x.operatorId, x.compiled, x.evaluated, x.hits, x.rate])).toEqual([['MO-H01', 1, 1, 1, 1], ['MO-H01n', 1, 1, 0, 0]]);
    expect(s[0]?.low).toBeCloseTo(0.2065, 3);
    expect(seedOf('a', 1)).toBe(seedOf('a', 1));
    expect(seedOf('a', 1)).not.toBe(seedOf('b', 1));
  });

  it('repository names cover the Pascal and kebab styles', () => {
    expect(kebab('OrderLine')).toBe('order-line');
    expect(repositoryNames('ReportPositionEntity')).toEqual(['ReportPositionEntityRepository.ts', 'report-position.repository.ts', 'report-position-repository.ts', 'report-position.repo.ts']);
  });
});

describe('every entry on the reference projects: an eligible site whose mutant type-checks', () => {
  let scratch: string;
  const bases = new Map<string, Base>();
  beforeAll(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hexddd-ops-'));
    for (const style of ['hexagonal', 'ddd'] as const) {
      const ref = loadReference(REPO, style);
      const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
      if (clean === undefined) throw new Error(style);
      const m = materialiseVariant(ref, clean, path.join(scratch, 'materialised'));
      bases.set(style, { baseId: `ref-${style}`, kind: 'reference', style, dir: m.projectDir, specPath: path.relative(REPO, ref.specPath), tsc: TSC });
    }
  });
  afterAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it.each(HEXDDD_OPERATORS.map((o) => [o.id, o] as const))('%s', async (_id, op) => {
    const style = positiveIdOf(op).startsWith('MO-D') ? 'ddd' : 'hexagonal';
    const base = bases.get(style) as Base;
    const compiled = await loadCompiledSpec(REPO, base.specPath);
    if (!compiled.success) throw new Error(compiled.errors[0]?.message);
    const baseCopy = path.join(scratch, `base-${style}`);
    if (!fs.existsSync(baseCopy)) copyProject(base.dir, baseCopy);
    const handle = openImportGraphProject(baseCopy, 'tsconfig.json');
    const ctx = await contextOf(compiled.data, base, handle);
    const tally = evaluatePreconditions(op, handle, compiled.data.spec, sortSites(op.findSites(handle, compiled.data.spec)), ctx);
    // MO-D05a needs a declared ACL folder: the DDD reference declares billing/acl. MO-H06n needs an interface in the
    // core; the hexagonal reference keeps every port in application/ports, and a core class injecting one would breach
    // core-isolation, so the twin has no legal site there (it has sites on the real projects).
    if (op.id === 'MO-H06n') {
      expect(tally.eligible).toEqual([]);
      return;
    }
    expect(tally.eligible.length).toBeGreaterThan(0);
    const site = tally.eligible[0]?.site as MutationSite;
    const dest = path.join(scratch, `copy-${op.id}`);
    copyProject(base.dir, dest);
    const h = openImportGraphProject(dest, 'tsconfig.json');
    const r = op.apply(h, site, mulberry32(1));
    if (!r.success) throw new Error(r.errors[0]?.message);
    await h.project.save();
    const uses = op.plannedImportUses?.(site) ?? [];
    if (uses.length > 0) expect(provisionStubs(dest, 'tsconfig.json', uses).success).toBe(true);
    expect(r.data.editedFiles.length + r.data.createdFiles.length).toBeGreaterThan(0);
    for (const f of r.data.editedFiles) expect(fs.readFileSync(path.join(dest, f), 'utf8')).not.toBe(fs.readFileSync(path.join(baseCopy, f), 'utf8'));
    expect(typecheck(TSC, dest)).toEqual([]);
  });
});
