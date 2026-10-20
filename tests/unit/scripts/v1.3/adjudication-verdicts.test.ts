/**
 * The adjudication verdicts and the adjudicated view (U6 design §6.2, §6.3; plan Step 3), on toy keys. DEVELOPMENT-SET
 * helpers; no reference graph is extracted here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { adjudicatedKey, checkVerdicts, parseVerdicts, readVerdicts, VERDICT_HEADER } from '../../../../scripts/v1.3/lib/adjudication-verdicts.js';
import { scoreBlind } from '../../../../scripts/v1.3/lib/blind-key.js';
import type { BlindKey, F } from '../../../../scripts/v1.3/lib/blind-key.js';
import type { LoadedReference } from '../../../../scripts/v1.3/lib/reference-model.js';
import { STATUS_QUO_ANSWERS, withAnswers } from '../../../../src/shared/construct-switches.js';

const HEAD = VERDICT_HEADER.join(',');
const line = (cells: string[]): string => cells.join(',');
const csv = (...rows: string[][]): string => [HEAD, ...rows.map(line)].join('\n') + '\n';

// A toy key: 3 styles. Cycles are stored canonically (sorted file pair), as `rebuildBlindKey` stores them.
const KEY: BlindKey = new Map<string, F[]>([
  ['clean/v01', [{ ruleId: 'FF-S01', file: 'd/Loan.ts', target: 'a/Clock.ts' }, { ruleId: 'FF-S02', file: 'a/Clock.ts', target: 'd/Loan.ts' }]],
  ['clean/v09', [{ ruleId: 'FF-S02', file: 'a/Dto.ts', target: 'i/Http.ts' }]],
  ['hex/v02', [{ ruleId: 'FF-S04', file: 'd/Booking.ts', target: 'a/Port.ts' }]],
  ['hex/v03', [{ ruleId: 'FF-P03', file: 'a/Svc.ts', target: 'o/Repo.ts' }, { ruleId: 'FF-S01', file: 'a/Svc.ts', target: 'o/Repo.ts' }]],
  ['hex/v05', [{ ruleId: 'FF-P03', file: 'i/Ctl.ts', target: 'o/Repo.ts' }]],
  ['nest/v07', [{ ruleId: 'FF-P03', file: 's.ts', target: 'r.ts' }]],
]);

const ROW = {
  c1: ['1', 'clean', 'v01', 'FF-S02', 'd/Loan.ts', 'a/Clock.ts', 'Q4'],
  c2: ['2', 'clean', 'v09', 'FF-S02', 'i/Http.ts', 'a/Dto.ts', 'Q4'],
  n1: ['N1', 'hex', 'v02', 'FF-S04', 'd/Booking.ts', 'a/Port.ts', 'Q6'],
  h10: ['10', 'hex', 'v03', 'FF-P03', 'a/Svc.ts', 'o/Repo.ts', 'Q7'],
  h13: ['13', 'hex', 'v05', 'FF-P03', 'i/Ctl.ts', 'o/Repo.ts', 'Q7'],
  n7: ['7', 'nest', 'v07', 'FF-P03', 's.ts', 'r.ts', 'Q7'],
};
const v = (row: string[], verdict: string, note = ''): string[] => [...row, verdict, note, 'author', '2026-10-19'];
const ANSWERS = withAnswers({ Q4: 'A', Q6: 'B', Q7: 'A', Q8: 'B' }, STATUS_QUO_ANSWERS);

describe('parseVerdicts', () => {
  it('parses rows, canonicalises cycle pairs and keeps quoted notes', () => {
    const rows = parseVerdicts(csv(v(ROW.c1, 'spec', '"Author-made file, not a run output."')));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rowId: '1', style: 'clean', variant: 'v01', question: 'Q4', verdict: 'spec', verdictNote: 'Author-made file, not a run output.' });
    expect(rows[0]?.row).toEqual({ ruleId: 'FF-S02', file: 'a/Clock.ts', target: 'd/Loan.ts' });
  });

  it('refuses a wrong header, an unknown verdict and an unknown question', () => {
    expect(() => parseVerdicts('row_id,style\n')).toThrow(/header/);
    expect(() => parseVerdicts(csv(v(ROW.c1, 'maybe')))).toThrow(/verdict "maybe"/);
    expect(() => parseVerdicts(csv([...ROW.c1.slice(0, 6), 'Q26', 'spec', '', 'author', 'x']))).toThrow(/question "Q26"/);
  });

  it('a missing file means no adjudicated view', () => {
    expect(readVerdicts(path.join(os.tmpdir(), 'no-such-verdicts-file.csv'))).toBeUndefined();
  });

  it('reads the committed verdict file: the 9 rows and N1, all spec', () => {
    const file = path.resolve(__dirname, '../../../../results/v1.3-reference/after-member-facts/adjudication-verdicts.csv');
    const rows = readVerdicts(file) ?? [];
    expect(rows.map((r) => r.rowId)).toEqual(['1', '2', '3', '4', '6', '7', '8', '10', '13', 'N1']);
    expect(new Set(rows.map((r) => r.verdict))).toEqual(new Set(['spec']));
    expect(fs.readFileSync(file, 'utf8')).toContain('Author-made file, not a run output');
  });
});

describe('checkVerdicts (BR-U6-C1)', () => {
  it('an unknown row is an error', () => {
    expect(() => checkVerdicts(parseVerdicts(csv(v(['9', 'clean', 'v01', 'FF-S03', 'x.ts', 'y.ts', 'Q4'], 'spec'))), KEY, ANSWERS)).toThrow(/not in the blind-expanded key/);
  });

  it('matches N1 against an agreed key row (not only adjudication.csv rows)', () => {
    const c = checkVerdicts(parseVerdicts(csv(v(ROW.n1, 'spec'))), KEY, ANSWERS);
    expect(c.removedLabels).toEqual(['N1 hex/v02 FF-S04 d/Booking.ts -> a/Port.ts']);
  });

  it('refuses a split Q4 group without notes', () => {
    expect(() => checkVerdicts(parseVerdicts(csv(v(ROW.c1, 'spec'), v(ROW.c2, 'blind'))), KEY, ANSWERS)).toThrow(/split verdict in the Q4 group/);
  });

  it('accepts a split Q7 group when every row carries a construct reason', () => {
    const c = checkVerdicts(parseVerdicts(csv(
      v(ROW.n7, 'spec', 'service is a consumer'),
      v(ROW.h10, 'undecided', 'no ports/out/ folder in the blind package'),
      v(ROW.h13, 'undecided', 'no ports/out/ folder in the blind package'),
    )), KEY, ANSWERS);
    expect(c.removedLabels).toHaveLength(1);
    expect(c.kept).toHaveLength(2);
    expect(c.inconsistencies).toEqual([]);
  });

  it('flags a blind verdict under Q4 A, and not under Q4 B', () => {
    const rows = parseVerdicts(csv(v(ROW.c1, 'blind'), v(ROW.c2, 'blind')));
    expect(checkVerdicts(rows, KEY, ANSWERS).inconsistencies).toEqual([
      '1 clean/v01 FF-S02 a/Clock.ts -> d/Loan.ts: blind right, construct says otherwise (Q4 = A; recovered only by Q4 B)',
      '2 clean/v09 FF-S02 a/Dto.ts -> i/Http.ts: blind right, construct says otherwise (Q4 = A; recovered only by Q4 B)',
    ]);
    expect(checkVerdicts(rows, KEY, withAnswers({ Q4: 'B' }, ANSWERS)).inconsistencies).toEqual([]);
  });

  it('refuses a duplicate row', () => {
    expect(() => checkVerdicts(parseVerdicts(csv(v(ROW.c1, 'spec'), v(ROW.c1, 'spec'))), KEY, ANSWERS)).toThrow(/duplicate/);
  });
});

describe('adjudicated view', () => {
  it('removes only the rows ruled spec, and the counts follow on a toy key of 3 styles', () => {
    const c = checkVerdicts(parseVerdicts(csv(v(ROW.c1, 'spec'), v(ROW.c2, 'spec'), v(ROW.n1, 'spec'), v(ROW.h10, 'spec', 'consumer, Q7 A'), v(ROW.h13, 'spec', 'consumer, Q7 A'), v(ROW.n7, 'undecided', 'a row-specific reason'))), KEY, ANSWERS);
    const adj = adjudicatedKey(KEY, c);
    expect(adj.get('clean/v01')).toEqual([{ ruleId: 'FF-S01', file: 'd/Loan.ts', target: 'a/Clock.ts' }]);
    expect(adj.get('nest/v07')).toEqual(KEY.get('nest/v07'));
    expect(KEY.get('clean/v01')).toHaveLength(2); // the input key is not mutated

    // Tool rows: the direction rows only.
    const tool = new Map<string, F[]>([
      ['clean/v01', [{ ruleId: 'FF-S01', file: 'd/Loan.ts', target: 'a/Clock.ts' }]],
      ['hex/v03', [{ ruleId: 'FF-S01', file: 'a/Svc.ts', target: 'o/Repo.ts' }]],
    ]);
    const all = new Set(['FF-S01', 'FF-S02', 'FF-S04', 'FF-P03']);
    const refs: Record<string, LoadedReference> = {
      clean: { style: 'clean', variants: [{ manifest: { variant: 'v01' } }, { manifest: { variant: 'v09' } }] } as unknown as LoadedReference,
      hex: { style: 'hex', variants: ['v02', 'v03', 'v05'].map((variant) => ({ manifest: { variant } })) } as unknown as LoadedReference,
      nest: { style: 'nest', variants: [{ manifest: { variant: 'v07' } }] } as unknown as LoadedReference,
    };
    const score = (k: BlindKey, style: string): string => {
      const s = scoreBlind(must(refs[style]), k, (variant) => tool.get(`${style}/${variant}`) ?? [], all, all, (_v, f) => f, () => false);
      return `${String(s.blocking.tp)}/${String(s.blocking.tp + s.blocking.fn)}`;
    };
    expect(['clean', 'hex', 'nest'].map((s) => score(KEY, s))).toEqual(['1/3', '1/4', '0/1']);
    expect(['clean', 'hex', 'nest'].map((s) => score(adj, s))).toEqual(['1/1', '1/1', '0/1']);
  });
});

function must<T>(x: T | undefined): T {
  if (x === undefined) throw new Error('missing');
  return x;
}
