/**
 * Operator registry and catalogue parser on an inline catalogue (U5a plan Step 8; BR-U5a-38, 39).
 */
import { catalogueVersionOf, OperatorRegistry } from '../../../../scripts/lib/mutation/registry.js';
import {
  parseCatalogue,
  renderOperatorTable,
  renderProbeTable,
} from '../../../../scripts/lib/mutation/catalogue-parser.js';
import type { OperatorCatalogueEntry, ProbeEntry } from '../../../../scripts/lib/mutation/catalogue-parser.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationOperator } from '../../../../scripts/lib/mutation/types.js';

const ENTRIES: OperatorCatalogueEntry[] = [
  {
    id: 'MO-S01',
    core: true,
    dimension: 'structural',
    tags: [],
    defect: 'domain file imports and uses an infrastructure symbol',
    expectedTemplates: ['dependency-direction', 'no-domain-outward-dep'],
    coverage: 'in',
    siteKinds: ['import-edge'],
    preconditions: ['edge-exists', 'cycle-cap'],
    operatorCollateral: [],
    twin: 'MO-S01n',
    source: 'Martin 2017',
  },
  {
    id: 'MO-DF01',
    core: true,
    dimension: 'pattern',
    tags: ['checks: data-flow (FR-21)'],
    defect: 'domain state written from infrastructure',
    expectedTemplates: ['domain-state-purity'],
    coverage: 'in',
    siteKinds: ['field-new', 'field-assignment'],
    preconditions: ['type-shape'],
    operatorCollateral: ['dependency-direction', 'no-domain-outward-dep'],
    twin: 'MO-DF01n',
    source: 'FR-21; Evans 2003',
  },
  {
    id: 'MO-S03',
    core: false,
    dimension: 'structural',
    tags: ['layered only'],
    defect: 'presentation file imports a persistence symbol directly',
    expectedTemplates: ['no-layer-skip'],
    coverage: 'in',
    siteKinds: ['import-edge'],
    preconditions: ['style-disabled', 'edge-exists'],
    operatorCollateral: [],
    twin: 'MO-S03n',
    source: 'Buschmann et al. 1996',
  },
];

const PROBES: ProbeEntry[] = [
  {
    id: 'SP-FF-S01',
    targetFunctionId: 'FF-S01',
    fixture: 'correct-reference',
    edit: 'domain imports infrastructure',
    passCriterion: 'returns a new row with key (FF-S01, src/domain/entities/Task.ts, …)',
  },
];

const CATALOGUE = [
  '# Operator catalogue (DRAFT)',
  '',
  'masterSeed: 20261008',
  '',
  '## Entries',
  '',
  renderOperatorTable(ENTRIES),
  '## SP-* probes',
  '',
  renderProbeTable(PROBES),
  '## Changelog',
  '',
  '| Date | Change |',
  '| --- | --- |',
  '| 2026-10-08 | draft |',
  '',
].join('\n');

function fakeOperator(id: string): MutationOperator {
  return {
    id,
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
    apply: () => DomainResult.fail([{ code: 'TEST', message: 'not applied' }]),
    plannedEdges: () => [],
  };
}

describe('catalogue parser (BR-U5a-38, 39)', () => {
  it('round-trips the entry table and the SP table', () => {
    const parsed = parseCatalogue(CATALOGUE);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.entries).toEqual(ENTRIES);
    expect(parsed.data.probes).toEqual(PROBES);
  });

  it('reads core/extension, backticked lists, an empty marker and an escaped pipe', () => {
    const md = [
      '| Id | Core | Dimension | Tags | Defect | Expected templates | Coverage | Site kinds | Preconditions | Operator collateral | Twin | Source |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      '| `MO-X01` | core | structural | outside coverage | uses `import()` | `dependency-direction`, `no-domain-outward-dep` | outside | `dynamic-import` | — | - | MO-X01n | Martin 2017 \\| ch. 22 |',
    ].join('\n');
    const parsed = parseCatalogue(md);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const [entry] = parsed.data.entries;
    expect(entry).toEqual({
      id: 'MO-X01',
      core: true,
      dimension: 'structural',
      tags: ['outside coverage'],
      defect: 'uses import()',
      expectedTemplates: ['dependency-direction', 'no-domain-outward-dep'],
      coverage: 'outside',
      siteKinds: ['dynamic-import'],
      preconditions: [],
      operatorCollateral: [],
      twin: 'MO-X01n',
      source: 'Martin 2017 | ch. 22',
    });
    expect(parsed.data.probes).toEqual([]);
  });

  it('refuses a duplicate id, unknown enums, a wrong cell count and a missing table', () => {
    const dup = CATALOGUE.replace('| MO-S03 |', '| MO-S01 |');
    const dupResult = parseCatalogue(dup);
    expect(!dupResult.success && dupResult.errors.map((e) => e.message).join()).toMatch(/duplicate id MO-S01/);

    const badDim = CATALOGUE.replace('| yes | pattern |', '| yes | data-flow |');
    const dimResult = parseCatalogue(badDim);
    expect(!dimResult.success && dimResult.errors[0]?.message).toMatch(/unknown dimension "data-flow"/);

    const badKind = CATALOGUE.replace('`field-new`', '`field-old`');
    const kindResult = parseCatalogue(badKind);
    expect(!kindResult.success && kindResult.errors[0]?.message).toMatch(/unknown site kind "field-old"/);

    const badReason = CATALOGUE.replace('`type-shape`', '`looks-wrong`');
    expect(parseCatalogue(badReason).success).toBe(false);

    const shortRow = CATALOGUE.replace('| Martin 2017 |', '|');
    expect(parseCatalogue(shortRow).success).toBe(false);

    const none = parseCatalogue('# empty\n');
    expect(!none.success && none.errors[0]?.message).toMatch(/operator entry table not found/);
  });
});

describe('catalogueVersionOf (BR-U5a-38)', () => {
  it('is the sha256 hex of the bytes, and a one-byte change alters it', () => {
    const v = catalogueVersionOf(CATALOGUE);
    expect(v).toMatch(/^[0-9a-f]{64}$/);
    expect(catalogueVersionOf(Buffer.from(CATALOGUE, 'utf8'))).toBe(v);
    expect(catalogueVersionOf(CATALOGUE.replace('20261008', '20261009'))).not.toBe(v);
    expect(catalogueVersionOf(CATALOGUE + ' ')).not.toBe(v);
  });
});

describe('OperatorRegistry (BR-U5a-39)', () => {
  const version = catalogueVersionOf(CATALOGUE);

  it('registers, gets and lists by id; refuses a duplicate id', () => {
    const reg = new OperatorRegistry(version);
    for (const id of ['MO-S03', 'MO-S01', 'MO-DF01']) expect(reg.register(fakeOperator(id)).success).toBe(true);
    const dup = reg.register(fakeOperator('MO-S01'));
    expect(!dup.success && dup.errors[0]?.code).toBe('CAT_DUPLICATE_ID');
    expect(reg.list().map((o) => o.id)).toEqual(['MO-DF01', 'MO-S01', 'MO-S03']);
    expect(reg.get('MO-S01')?.id).toBe('MO-S01');
    expect(reg.get('MO-X99')).toBeUndefined();
    expect(reg.catalogueVersion).toBe(version);
  });

  it('refuses register after freeze with CAT_FROZEN', () => {
    const reg = new OperatorRegistry(version);
    reg.register(fakeOperator('MO-S01'));
    reg.freeze();
    expect(reg.isFrozen).toBe(true);
    const late = reg.register(fakeOperator('MO-P01'));
    expect(!late.success && late.errors[0]?.code).toBe('CAT_FROZEN');
    expect(reg.list()).toHaveLength(1);
  });

  it("refuses an id with '|' and a catalogue version that is not sha256 hex", () => {
    const reg = new OperatorRegistry(version);
    const bad = reg.register(fakeOperator('MO|S01'));
    expect(!bad.success && bad.errors[0]?.code).toBe('CAT_INVALID_ID');
    expect(() => new OperatorRegistry('v1')).toThrow(RangeError);
  });

  it('matches the parsed catalogue one to one on id (shape of the Step 31 equality test)', () => {
    const parsed = parseCatalogue(CATALOGUE);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const reg = new OperatorRegistry(version);
    for (const e of parsed.data.entries) reg.register(fakeOperator(e.id));
    reg.freeze();
    expect(reg.list().map((o) => o.id)).toEqual(parsed.data.entries.map((e) => e.id).sort());
  });
});
