/** T-PROMPT (design DR-6, DR-7, DR-8; A1 DR-A1-1): the frame byte for byte, the architecture block, the hashes. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { architectureBlock, sha256Hex } from '../../../../../scripts/v1.3/lib/eff01/inputs.js';
import { buildPrompt, CALIBRATION_PROMPT, FRAME_SHA256, FRAME_TEMPLATE } from '../../../../../scripts/v1.3/lib/eff01/prompt.js';
import { CONDITION_SENTENCES, GRAPH_SENTENCE, READING_SENTENCE } from '../../../../../scripts/v1.3/lib/eff01/types.js';
import { inputs, REPO } from './helpers.js';

const question = { text: 'How many import statements in the project break the spec\'s allowed dependencies?', answerFormat: { count: '<integer>' } };

describe('EFF-01 prompt frame (T-PROMPT)', () => {
  it('matches the note §5 frame byte for byte, with the A1 condition sentence', () => {
    const p = buildPrompt({ condition: 'R', archBlock: 'architecture:\n  style: ddd', conventions: ['c1', 'c2'], question });
    expect(p).toBe(
      'You are answering one question about the architecture of a TypeScript project. Base your answer on evidence you gather in this session.\n' +
        '\n' +
        "You can read the project's files with the Read, Grep and Glob tools; the project root is the working directory. Read the project's docs (README, ADRs, code comments) and its code before you answer.\n" +
        '\n' +
        "The project's architecture spec (the `architecture:` block of its spec YAML):\n" +
        'architecture:\n  style: ddd\n' +
        '\n' +
        'Conventions:\nc1\nc2\n' +
        '\n' +
        "Question: How many import statements in the project break the spec's allowed dependencies?\n" +
        '\n' +
        'End your reply with exactly one line:\n' +
        'ANSWER: {"count":"<integer>"}\n',
    );
  });

  it('differs between conditions only in the condition sentence; G adds the graph sentence to the reading one (A1)', () => {
    const args = { archBlock: 'architecture:', conventions: ['c'], question };
    const r = buildPrompt({ condition: 'R', ...args });
    const g = buildPrompt({ condition: 'G', ...args });
    const n = buildPrompt({ condition: 'N', ...args });
    expect(CONDITION_SENTENCES.G).toBe(`${READING_SENTENCE} ${GRAPH_SENTENCE}`);
    expect(g.replace(CONDITION_SENTENCES.G, 'X')).toBe(r.replace(CONDITION_SENTENCES.R, 'X'));
    expect(n.replace(CONDITION_SENTENCES.N, 'X')).toBe(r.replace(CONDITION_SENTENCES.R, 'X'));
    expect(CONDITION_SENTENCES.N).toBe('You have no tools; answer from the spec below and what you already know.');
  });

  it('keeps $ and {{ }} inside the spec text verbatim (one-pass replacement)', () => {
    const p = buildPrompt({ condition: 'N', archBlock: 'architecture:\n  # cost $1 {{QUESTION}} $&', conventions: [], question });
    expect(p).toContain('  # cost $1 {{QUESTION}} $&\n');
  });

  it('uses the four committed conventions, one per line, and the answerFormat as compact JSON', () => {
    const ins = inputs();
    const q = ins.questionById.get('DF-Q09');
    if (q === undefined) throw new Error('DF-Q09 missing');
    const p = buildPrompt({ condition: 'G', archBlock: 'architecture:', conventions: ins.conventions, question: q });
    expect(ins.conventions).toHaveLength(4);
    expect(p).toContain(`Conventions:\n${ins.conventions.join('\n')}\n`);
    expect(p).toContain('ANSWER: {"implementers":[{"class":"<name>","file":"<path>"}]}\n');
  });

  it('has a stable frame hash and a fixed calibration prompt', () => {
    expect(FRAME_SHA256).toBe(sha256Hex(FRAME_TEMPLATE));
    expect(FRAME_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(CALIBRATION_PROMPT).toBe('Reply OK');
  });
});

describe('architecture block (DR-7)', () => {
  for (const id of ['event-sourcing-ddd', 'ddd-forum']) {
    it(`cuts ${id}'s block from architecture: to before fitness_functions:`, () => {
      const text = fs.readFileSync(path.join(REPO, `results/v1.3-external/specs/${id}.yaml`), 'utf8');
      expect(text.split('\n')[1]).toContain('`architecture:`'); // the comment that a substring count would also find
      const r = architectureBlock(text);
      if (!r.success) throw new Error(r.errors[0]?.message);
      expect(r.data.startsWith('architecture:\n')).toBe(true);
      expect(r.data).not.toContain('fitness_functions:');
      const lines = text.split('\n');
      const ff = lines.findIndex((l) => l.startsWith('fitness_functions:'));
      const start = lines.findIndex((l) => /^architecture:\s*$/.test(l));
      expect(r.data).toBe(lines.slice(start, ff).join('\n').replace(/\n+$/, ''));
      const again = architectureBlock(text);
      expect(again.success && sha256Hex(again.data)).toBe(sha256Hex(r.data));
    });
  }

  it('keeps comments by default and strips them on request (author question 8)', () => {
    const spec = 'spec_version: "1"\narchitecture:\n  # rationale FF-DS02\n  style: ddd\n\nscoring:\n  x: 1\n';
    const kept = architectureBlock(spec);
    const stripped = architectureBlock(spec, { stripComments: true });
    expect(kept.success && kept.data).toBe('architecture:\n  # rationale FF-DS02\n  style: ddd');
    expect(stripped.success && stripped.data).toBe('architecture:\n  style: ddd');
  });

  it('refuses a spec with no or two architecture: lines', () => {
    expect(architectureBlock('spec_version: 1\n').success).toBe(false);
    expect(architectureBlock('architecture:\n  a: 1\narchitecture:\n  b: 2\n').success).toBe(false);
  });
});
