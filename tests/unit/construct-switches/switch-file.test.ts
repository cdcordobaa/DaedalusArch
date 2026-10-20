/**
 * The switch file and the answer script's library: one entry per question, at the author's answers; the code/no-code marks equal the
 * catalogue; both answer formats parse; the generated block round-trips; the sign-off lists the tier ADRs.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CONSTRUCT_SWITCHES, isStatusQuo, STATUS_QUO_ANSWERS, withAnswers } from '../../../src/shared/construct-switches.js';
import { CONSTRUCT_QUESTION_IDS, CONSTRUCT_QUESTIONS, optionsOf } from '../../../src/shared/construct-switch-catalogue.js';
import {
  kindsOf, optionOf, parseAnswersDocument, questionIdOf, renderSwitchBlock, replaceSwitchBlock, signOffLines, SWITCH_FILE, writeSwitchFile,
} from '../../../scripts/v1.3/lib/construct-answers.js';

const REPO = path.resolve(__dirname, '../../..');
/** The author's answers (signed 2026-10-19), applied by `apply-construct-answers.ts` (U6 plan Step 6). */
const ANSWERS = parseAnswersDocument(JSON.parse(fs.readFileSync(path.join(REPO, 'Docs/v1.3/construct-answers.json'), 'utf8')) as unknown);

describe('the switch file', () => {
  it('has one entry per question, in order, each at the option of the answers file', () => {
    expect(CONSTRUCT_SWITCHES.map((s) => s.Q)).toEqual([...CONSTRUCT_QUESTION_IDS]);
    expect(CONSTRUCT_SWITCHES.map((s) => s.option)).toEqual(CONSTRUCT_QUESTION_IDS.map((q) => ANSWERS.answers[q]));
  });

  it('marks code / no-code exactly as the catalogue, and every A is no-code', () => {
    for (const s of CONSTRUCT_SWITCHES) {
      expect(s.kinds).toEqual(kindsOf(s.Q));
      expect(s.kinds.A).toBe('no-code');
      expect(Object.keys(s.kinds)).toEqual([...optionsOf(s.Q)]);
    }
  });

  it('its generated block is what the answer script writes for the answers file (freeze-check F2)', () => {
    const text = fs.readFileSync(path.join(REPO, SWITCH_FILE), 'utf8');
    expect(replaceSwitchBlock(text, renderSwitchBlock(ANSWERS.answers, ANSWERS.notes))).toBe(text);
  });

  it('every non-A option that changes behaviour is marked code, and the only no-code non-A option is Q14 C', () => {
    const noCode = CONSTRUCT_QUESTIONS.flatMap((q) => optionsOf(q.id).filter((o) => o !== 'A' && q.options[o]?.kind === 'no-code').map((o) => `${q.id}${o}`));
    expect(noCode).toEqual(['Q14C']);
    expect(isStatusQuo(withAnswers({ Q14: 'C' }))).toBe(true);
    expect(isStatusQuo(withAnswers({ Q3: 'C' }))).toBe(false);
  });
});

describe('parsing the answers', () => {
  it('reads ids and choices loosely', () => {
    expect(['Q3', 'q3', '3', 'Q03', 'Question 3'].map(questionIdOf)).toEqual(['Q3', 'Q3', 'Q3', 'Q3', 'Q3']);
    expect(questionIdOf('Q26')).toBeUndefined();
    expect(['C', 'c', 'C: advisory in-layer', 'Option C'].map(optionOf)).toEqual(['C', 'C', 'C', 'C']);
    expect(optionOf('')).toBeUndefined();
    expect(optionOf('Defer')).toBeUndefined();
  });

  it('reads a plain map', () => {
    const p = parseAnswersDocument({ Q3: 'C', Q5: { choice: 'D', note: 'new id' }, Q8: '' });
    expect(p.answers.Q3).toBe('C');
    expect(p.answers.Q5).toBe('D');
    expect(p.answers.Q8).toBe('A');
    expect([...p.answered].sort()).toEqual(['Q3', 'Q5']);
    expect(p.notes.Q5).toBe('new id');
  });

  it.each([
    ['an array of documents with data', [{ doc_id: 'Q3', data: { choice: 'C', note: 'n' } }, { doc_id: 'Q16', data: { choice: 'B' } }]],
    ['a documents envelope with fields', { collection: 'answers', documents: [{ id: 'Q3', fields: { choice: 'C', note: 'n' } }, { id: 'Q16', fields: { choice: 'B' } }] }],
    ['flat documents', { docs: [{ id: 'Q3', choice: 'C', note: 'n' }, { id: 'Q16', choice: 'B' }] }],
  ])('reads the decision board export: %s', (_label, doc) => {
    const p = parseAnswersDocument(doc);
    expect(p.answers.Q3).toBe('C');
    expect(p.answers.Q16).toBe('B');
    expect(p.notes.Q3).toBe('n');
    expect(p.answered.size).toBe(2);
  });

  it('rejects an option the question does not offer, and warns on an unknown key', () => {
    expect(() => parseAnswersDocument({ Q2: 'C' })).toThrow('Q2 has no option C');
    expect(parseAnswersDocument({ foo: 'A' }).warnings[0]).toContain('not a question id');
  });
});

describe('writing the switch file and the sign-off', () => {
  it('writes the answers into a copy of the switch file and reads back', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'construct-switch-'));
    try {
      const file = path.join(tmp, 'construct-switches.ts');
      fs.copyFileSync(path.join(REPO, SWITCH_FILE), file);
      writeSwitchFile(file, withAnswers({ Q3: 'C', Q5: 'D' }), { Q5: 'adapter "isolation"' });
      const text = fs.readFileSync(file, 'utf8');
      expect(text).toContain("{ Q: 'Q3', option: 'C', kinds: { A: 'no-code', B: 'code', C: 'code' } },");
      expect(text).toContain(`{ Q: 'Q5', option: 'D', kinds: { A: 'no-code', B: 'code', C: 'code', D: 'code' }, note: "adapter \\"isolation\\"" },`);
      expect(text.split('\n').filter((l) => l.includes("option: 'A'"))).toHaveLength(23);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('lists the tier ADRs for the tier options, the ADR-V13-03 entries, the action items and the re-run', () => {
    const lines = signOffLines(parseAnswersDocument({ Q3: 'C', Q5: 'D', Q13: 'B', Q16: 'B', Q2: 'A' })).join('\n');
    expect(lines).toContain('Q3 C: FF-S02 split');
    expect(lines).toContain('Q5 D: new tier row: FF-S05');
    expect(lines).toContain('Q13: fix the contradiction');
    expect(lines).toContain('Q16 B: one development-set run before the hold-out');
    expect(lines).toContain('scripts/v1.3/ue-baseline-live.ts');
    expect(lines).toContain('Unanswered, left at A:');
    const none = signOffLines(parseAnswersDocument({})).join('\n');
    expect(none).toContain('Code options in force: none (status quo)');
  });
});
