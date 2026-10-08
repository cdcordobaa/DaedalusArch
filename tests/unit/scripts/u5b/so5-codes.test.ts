/**
 * U5b Step 14: SO5 code tables in `Docs/analysis-plan.md` (BR-U5b-30, 64). The prose tables and the machine block
 * are equal; the loader refuses a missing, duplicated or malformed block naming the file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYSIS_PLAN_DOC, FPAT_FAMILIES, loadSo5Codes, parseSo5Codes, SO5_CODES_INVALID } from '../../../../scripts/lib/so5-codes.js';
import { ROOT } from './score-fixture.js';

const DOC = readFileSync(join(ROOT, ANALYSIS_PLAN_DOC), 'utf8');

function tableRows(firstHeader: string): string[][] {
  const lines = DOC.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  const rows: string[][] = [];
  for (let i = start + 2; i < lines.length && (lines[i] ?? '').startsWith('|'); i++) {
    rows.push((lines[i] ?? '').split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows;
}
const ticks = (cell: string): string[] => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');

describe('SO5 code tables (BR-U5b-64)', () => {
  it('the repository block loads: ten families, 25 template rows, two judge dimensions, seven GEN codes', () => {
    const load = loadSo5Codes(ROOT);
    if (!load.ok) throw new Error(load.detail);
    expect([...load.codes.fpatFamilies]).toEqual([...FPAT_FAMILIES]);
    expect(Object.keys(load.codes.functionFamilies)).toHaveLength(25);
    expect(load.codes.judgeDimensions).toEqual({ semantic: 'FPAT-SEMANTIC', integrity: 'FPAT-INTEGRITY' });
    expect(Object.keys(load.codes.genCodes)).toHaveLength(7);
  });

  it('the prose tables equal the machine block', () => {
    const load = loadSo5Codes(ROOT);
    if (!load.ok) throw new Error(load.detail);
    const fromTable: Record<string, string> = {};
    for (const [family = '', , members = ''] of tableRows('Family')) {
      for (const m of ticks(members)) fromTable[m] = ticks(family)[0] ?? '';
    }
    expect(fromTable).toEqual({ ...load.codes.functionFamilies, ...load.codes.judgeDimensions });
    const gen: Record<string, string> = {};
    for (const [r = '', c = ''] of tableRows('`failureReason`')) gen[ticks(r)[0] ?? ''] = ticks(c)[0] ?? '';
    expect(gen).toEqual(load.codes.genCodes);
  });

  it('refuses a missing, duplicated or malformed block, naming the file', () => {
    const block = DOC.slice(DOC.indexOf('```yaml so5-codes'));
    for (const doc of ['no block', `${block}\n${block}`, '```yaml so5-codes\n: [\n```\n', block.replace('GEN-TIMEOUT', 'GEN-TIMEOUTS'), block.replace('  - FPAT-CYCLE\n', '')]) {
      const r = parseSo5Codes(doc);
      expect(r).toMatchObject({ ok: false, code: SO5_CODES_INVALID });
      if (!r.ok) expect(r.detail.startsWith(ANALYSIS_PLAN_DOC)).toBe(true);
    }
    expect(parseSo5Codes(block).ok).toBe(true);
  });
});
