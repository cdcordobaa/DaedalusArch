/**
 * v1.3 rule tiers (FR-V6, unit U-D). The code table `RULE_TIERS` must equal the sealed document
 * Docs/v1.3/rule-tiers.md, which this test parses; every rule id of every registered library has a tier.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEXAGONAL_RULE_TIERS, RULE_TIERS, RULE_TIERS_DOC, ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { EXTENSION_TEMPLATES, TEMPLATE_REGISTRY } from '../../../src/spec-parser/template-registry.js';
import { HEXAGONAL_TEMPLATES } from '../../../src/fitness-compiler/hexagonal-templates.js';

const ROOT = join(__dirname, '../../..');
const DOC = readFileSync(join(ROOT, RULE_TIERS_DOC), 'utf8');

/** Table rows (cells) under the `## <heading>` section, header and separator dropped. */
function tableRows(heading: string): string[][] {
  const start = DOC.indexOf(`## ${heading}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = DOC.slice(start + 3);
  const end = rest.indexOf('\n## ');
  const section = end < 0 ? rest : rest.slice(0, end);
  const lines = section.split('\n').filter((l) => l.startsWith('|'));
  return lines.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

/** `FF-C01..C06` → FF-C01..FF-C06; `FF-N01, FF-N02` → both; `FF-S01` → itself. */
function expandIds(cell: string): string[] {
  const range = /^(FF-[A-Z]+)(\d+)\.\.([A-Z]+)(\d+)$/.exec(cell);
  if (range !== null) {
    const [, prefix, from, , to] = range as unknown as [string, string, string, string, string];
    const width = from.length;
    const out: string[] = [];
    for (let n = Number(from); n <= Number(to); n++) out.push(`${prefix}${String(n).padStart(width, '0')}`);
    return out;
  }
  return cell.split(',').map((s) => s.trim());
}

/** The document's tier cell, read as the (default, layered) tier pair. */
function docTier(cell: string): { tier: string; layered: string } {
  const t = cell.replace(/\*/g, '');
  if (t.startsWith('blocking only for `layered`')) return { tier: 'advisory', layered: 'blocking' };
  if (t.startsWith('blocking')) return { tier: 'blocking', layered: 'blocking' };
  if (t.startsWith('advisory') || t.startsWith('reported, non-blocking')) return { tier: 'advisory', layered: 'advisory' };
  throw new Error(`unparsed tier cell: ${cell}`);
}

describe('v1.3 rule tiers: the table equals Docs/v1.3/rule-tiers.md (FR-V6)', () => {
  it('reads the sealed document (sha256 recorded in Docs/v1.3/sealed-hashes.md)', () => {
    const sealed = readFileSync(join(ROOT, 'Docs/v1.3/sealed-hashes.md'), 'utf8');
    const row = sealed.split('\n').find((l) => l.startsWith('| Docs/v1.3/rule-tiers.md |'));
    const hash = row?.split('|')[2]?.trim();
    expect(createHash('sha256').update(DOC).digest('hex')).toBe(hash);
  });

  const existing = tableRows('Existing rules');
  const docIds = existing.flatMap((cells) => expandIds(cells[0] ?? '').map((id) => ({ id, cells })));

  it('lists exactly the document\'s rule ids (27)', () => {
    expect(docIds).toHaveLength(27);
    expect([...RULE_TIERS.keys()].sort()).toEqual(docIds.map((d) => d.id).sort());
  });

  it.each(docIds.map((d) => [d.id, d.cells] as const))('%s has the document\'s tier', (id, cells) => {
    const expected = docTier(cells[3] ?? '');
    expect(ruleTier(id).tier).toBe(expected.tier);
    expect(ruleTier(id, 'layered').tier).toBe(expected.layered);
    expect(ruleTier(id).source).toBe('table');
  });

  it('marks FF-N01 and FF-N02 as judge rules (reported, non-blocking) and only them', () => {
    expect([...RULE_TIERS.values()].filter((e) => e.judge === true).map((e) => e.ruleId)).toEqual(['FF-N01', 'FF-N02']);
  });

  it('FF-P06 is blocking and partial: its FLOWS_TO rows are N/A', () => {
    expect(ruleTier('FF-P06').tier).toBe('blocking');
    expect(RULE_TIERS.get('FF-P06')?.partial?.naRelType).toBe('FLOWS_TO');
    expect([...RULE_TIERS.values()].filter((e) => e.partial !== undefined).map((e) => e.ruleId)).toEqual(['FF-P06']);
  });

  it('FF-S03 depends on the style: blocking only for layered', () => {
    expect(ruleTier('FF-S03', 'layered').tier).toBe('blocking');
    expect(ruleTier('FF-S03', 'LAYERED').tier).toBe('blocking');
    for (const style of ['clean-architecture', 'nestjs', 'hexagonal', undefined]) {
      expect(ruleTier('FF-S03', style).tier).toBe('advisory');
    }
    expect([...RULE_TIERS.values()].filter((e) => e.byStyle !== undefined).map((e) => e.ruleId)).toEqual(['FF-S03']);
  });

  it('every rule id of every registered library (frozen and extension) has a table tier', () => {
    const libraries = [...TEMPLATE_REGISTRY.values(), ...EXTENSION_TEMPLATES.values()];
    expect(libraries.map((l) => l.style).sort()).toEqual(['clean-architecture', 'hexagonal', 'layered', 'nestjs']);
    for (const lib of libraries) {
      for (const f of lib.functions) {
        expect([lib.style, String(f.id), ruleTier(String(f.id), lib.style).source]).toEqual([lib.style, String(f.id), 'table']);
      }
    }
  });

  it('an id outside the table is advisory by default and says so', () => {
    expect(ruleTier('ADR-001')).toEqual({ tier: 'advisory', source: 'untiered-default' });
  });
});

describe('v1.3 rule tiers: the hexagonal templates (rule-tiers.md, second table)', () => {
  const rows = tableRows('New v1.3 rules').filter((c) => (c[0] ?? '').endsWith('(hexagonal)'));

  it('covers the five hexagonal templates', () => {
    expect(rows.map((c) => (c[0] ?? '').replace(' (hexagonal)', '')).sort()).toEqual([...HEXAGONAL_TEMPLATES.keys()].sort());
    expect([...HEXAGONAL_RULE_TIERS.keys()].sort()).toEqual([...HEXAGONAL_TEMPLATES.keys()].sort());
  });

  it.each(rows.map((c) => [(c[0] ?? '').replace(' (hexagonal)', ''), c[1] ?? ''] as const))('%s: tier as documented, same as its id\'s row', (name, cell) => {
    const entry = HEXAGONAL_RULE_TIERS.get(name);
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    if (name !== 'port-dependency-inversion') expect(entry.tier).toBe(cell);
    // The hexagonal library gives the template this id, and the id-keyed lookup agrees under the hexagonal style.
    const hex = EXTENSION_TEMPLATES.get('hexagonal')?.functions.find((f) => f.name === name);
    expect(String(hex?.id)).toBe(entry.ruleId);
    expect(ruleTier(entry.ruleId, 'hexagonal').tier).toBe(entry.tier);
  });

  it('port-dependency-inversion is advisory because its Cypher is a ratio against a threshold (not a pure edge fact)', () => {
    const cypher = HEXAGONAL_TEMPLATES.get('port-dependency-inversion')?.template ?? '';
    expect(cypher).toMatch(/AS ratio/);
    expect(cypher).toMatch(/ratio < \$threshold/);
    expect(HEXAGONAL_RULE_TIERS.get('port-dependency-inversion')?.tier).toBe('advisory');
  });
});
