/**
 * v1.4 U2 post-seal tiers (design BR-U2-06, §6 test 6; plan step 9.5): the dated record
 * `Docs/v1.4/rule-tiers-post-seal.md` equals the code tables, the sealed record keeps its sealed hash, and `ruleTier`
 * resolves the post-seal rules with the right source.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POST_SEAL_RULE_TIERS, POST_SEAL_TIERS_DOC, RULE_TIERS_DOC, ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { POST_SEAL_RULES } from '../../../src/fitness-compiler/post-seal-rules.js';
import { constructRuleTier } from '../../../src/construct-switches/tiers.js';
import { STATUS_QUO_ANSWERS } from '../../../src/shared/construct-switches.js';
import { tierTableOf } from '../../../src/scoring-engine/tiered-scoring.js';
import { ROOT } from './helpers.js';

interface Row { readonly rule: string; readonly template: string; readonly style: string; readonly tier: string; readonly adr: string }

function recordRows(): Row[] {
  const doc = readFileSync(join(ROOT, POST_SEAL_TIERS_DOC), 'utf8');
  const start = doc.indexOf('## Table');
  expect(start).toBeGreaterThanOrEqual(0);
  const lines = doc.slice(start).split('\n').filter((l) => l.startsWith('|'));
  return lines.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim())).map(([rule, template, style, tier, , adr]) => ({
    rule: rule ?? '', template: template ?? '', style: style ?? '', tier: tier ?? '', adr: adr ?? '',
  }));
}

describe('post-seal tier record', () => {
  it('lists exactly the (rule, style) pairs of POST_SEAL_RULES, with the template and ADR of the table', () => {
    const fromCode = POST_SEAL_RULES.flatMap((r) => r.styles.map((style) => ({ rule: r.ruleId, template: r.name, style, adr: r.adr })));
    const key = (x: { rule: string; style: string }): string => `${x.rule}|${x.style}`;
    expect(recordRows().map(({ tier: _t, ...rest }) => rest).sort((a, b) => key(a).localeCompare(key(b))))
      .toEqual(fromCode.sort((a, b) => key(a).localeCompare(key(b))));
  });

  it('each row tier equals ruleTier(rule, style), and its source is post-seal for FF-P07 and table for FF-S02', () => {
    for (const row of recordRows()) {
      const t = ruleTier(row.rule, row.style);
      expect({ ...row, codeTier: t.tier }).toEqual({ ...row, codeTier: row.tier });
      expect(t.source).toBe(POST_SEAL_RULE_TIERS.has(row.rule) ? 'post-seal' : 'table');
    }
  });

  it('POST_SEAL_RULE_TIERS holds the rules the sealed table does not tier, each with its ADR', () => {
    expect([...POST_SEAL_RULE_TIERS.keys()]).toEqual(['FF-P07']);
    expect(POST_SEAL_RULE_TIERS.get('FF-P07')?.adr).toBe(POST_SEAL_RULES.find((r) => r.ruleId === 'FF-P07')?.adr);
  });

  it('ruleTier: FF-P07 blocking in each post-seal style, FF-S02 in ddd blocking from the sealed table', () => {
    for (const style of ['clean-architecture', 'hexagonal', 'nestjs', 'ddd']) {
      expect(ruleTier('FF-P07', style)).toMatchObject({ tier: 'blocking', source: 'post-seal' });
    }
    expect(ruleTier('FF-S02', 'ddd')).toMatchObject({ tier: 'blocking', source: 'table' });
    expect(ruleTier('FF-X99', 'ddd')).toEqual({ tier: 'advisory', source: 'untiered-default' });
  });

  it('constructRuleTier at the status quo agrees with ruleTier for the post-seal rules', () => {
    for (const style of ['clean-architecture', 'hexagonal', 'nestjs', 'ddd']) {
      expect(constructRuleTier('FF-P07', style, STATUS_QUO_ANSWERS)).toEqual(ruleTier('FF-P07', style));
    }
    expect(constructRuleTier('FF-S02', 'ddd', STATUS_QUO_ANSWERS)).toEqual(ruleTier('FF-S02', 'ddd'));
  });

  it('tiers.tierTable names both records only when the post-seal rules were compiled', () => {
    expect(tierTableOf(undefined)).toBe(RULE_TIERS_DOC);
    expect(tierTableOf(false)).toBe(RULE_TIERS_DOC);
    expect(tierTableOf(true)).toBe(`${RULE_TIERS_DOC}; ${POST_SEAL_TIERS_DOC}`);
  });
});

describe('the sealed record is unchanged', () => {
  it('sha256 of Docs/v1.3/rule-tiers.md equals its row in Docs/v1.3/sealed-hashes.md', () => {
    const sealed = readFileSync(join(ROOT, 'Docs/v1.3/sealed-hashes.md'), 'utf8');
    const row = sealed.split('\n').find((l) => l.startsWith(`| ${RULE_TIERS_DOC} |`));
    const expected = row?.split('|')[2]?.trim();
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
    expect(createHash('sha256').update(readFileSync(join(ROOT, RULE_TIERS_DOC))).digest('hex')).toBe(expected);
  });
});
