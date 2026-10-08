// BR-U4-VRD-02..06, T12 (U4 plan Step 14): strict verdict parsing over the committed probe
// envelopes, the VRD-03 table, VRD-05 path normalisation and VRD-06 membership.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateVerdict, parseVerdictText, parseEnvelopeVerdict, parseVerdict, firstJsonObject,
  normaliseViolationPath, filterMembers,
} from '../../../src/llm-critic/verdict-parser.js';

const FIXTURES = resolve(__dirname, '../../fixtures/claude-cli');
function envelope(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8')) as Record<string, unknown>;
}

const GOOD = { pass: false, confidence: 0.8, reasoning: 'r', evidence: ['e'], violations: [{ filePath: 'src/a.ts', message: 'm' }] };

describe('VRD-03 strictness table', () => {
  const cases: [string, unknown, string][] = [
    ['valid verdict', GOOD, 'valid'],
    ['missing confidence', { pass: true, reasoning: 'r', evidence: [], violations: [] }, 'MISSING_CONFIDENCE'],
    ['confidence 1.2', { ...GOOD, confidence: 1.2 }, 'PARSE_FAILURE'],
    ['confidence -0.1', { ...GOOD, confidence: -0.1 }, 'PARSE_FAILURE'],
    ['confidence as string', { ...GOOD, confidence: '0.9' }, 'PARSE_FAILURE'],
    ['extra property', { ...GOOD, verdict: 'pass' }, 'PARSE_FAILURE'],
    ['missing pass', { confidence: 0.5, reasoning: 'r', evidence: [], violations: [] }, 'PARSE_FAILURE'],
    ['missing reasoning', { pass: true, confidence: 0.5, evidence: [], violations: [] }, 'PARSE_FAILURE'],
    ['missing evidence', { pass: true, confidence: 0.5, reasoning: 'r', violations: [] }, 'PARSE_FAILURE'],
    ['missing violations', { pass: true, confidence: 0.5, reasoning: 'r', evidence: [] }, 'PARSE_FAILURE'],
    ['pass as string', { ...GOOD, pass: 'false' }, 'PARSE_FAILURE'],
    ['violation without filePath', { ...GOOD, violations: [{ message: 'm' }] }, 'PARSE_FAILURE'],
    ['violation with line', { ...GOOD, violations: [{ filePath: 'a', message: 'm', line: 3 }] }, 'PARSE_FAILURE'],
    ['reasoning over 2000', { ...GOOD, reasoning: 'x'.repeat(2001) }, 'PARSE_FAILURE'],
    ['eleven evidence items', { ...GOOD, evidence: Array.from({ length: 11 }, () => 'e') }, 'PARSE_FAILURE'],
    ['twenty-one violations', { ...GOOD, violations: Array.from({ length: 21 }, () => ({ filePath: 'a', message: 'm' })) }, 'PARSE_FAILURE'],
    ['array, not object', [GOOD], 'PARSE_FAILURE'],
    ['null', null, 'PARSE_FAILURE'],
  ];
  it.each(cases)('%s', (_name, value, expected) => {
    const outcome = validateVerdict(value);
    expect(outcome.kind === 'valid' ? 'valid' : outcome.cause).toBe(expected);
  });

  it('counts maxLength in code points', () => {
    expect(validateVerdict({ ...GOOD, reasoning: '\u{1F600}'.repeat(2000) }).kind).toBe('valid');
  });

  it('keeps the verdict values as given, no defaults', () => {
    const outcome = validateVerdict({ pass: true, confidence: 0, reasoning: '', evidence: [], violations: [] });
    expect(outcome).toEqual({ kind: 'valid', verdict: { pass: true, confidence: 0, reasoning: '', evidence: [], violations: [] } });
  });
});

describe('VRD-02 parse source', () => {
  it('reads structured_output from the schema envelopes (tools off and on)', () => {
    for (const name of ['envelope-schema-tools-off.json', 'envelope-schema-tools-on.json']) {
      const env = envelope(name);
      const outcome = parseEnvelopeVerdict(env);
      expect(outcome.kind).toBe('valid');
      if (outcome.kind === 'valid') {
        expect(outcome.verdict).toEqual(env.structured_output);
      }
    }
  });

  it('prefers structured_output over a different result text', () => {
    const env = { ...envelope('envelope-schema-tools-off.json'), result: '{"pass":false}' };
    expect(parseEnvelopeVerdict(env).kind).toBe('valid');
  });

  it('falls back to the fenced result text without --json-schema; the model-chosen shape fails the schema', () => {
    const env = envelope('envelope-noschema.json');
    expect('structured_output' in env).toBe(false);
    expect(firstJsonObject(env.result as string)).toMatchObject({ rule: 'FF-PROBE-01' });
    const outcome = parseEnvelopeVerdict(env);
    expect(outcome).toMatchObject({ kind: 'invalid', cause: 'MISSING_CONFIDENCE' });
  });

  it('parses a fenced, schema-shaped result when no structured field exists', () => {
    const env = { result: 'Here it is:\n```json\n' + JSON.stringify(GOOD) + '\n```\nDone.' };
    expect(parseEnvelopeVerdict(env)).toEqual({ kind: 'valid', verdict: GOOD });
  });

  it('takes the first top-level object and skips braces that are not JSON or sit inside strings', () => {
    const text = 'note {not json} then ' + JSON.stringify({ ...GOOD, reasoning: 'has } and { inside' }) + ' and {"later": 1}';
    expect(parseVerdictText(text)).toEqual({ kind: 'valid', verdict: { ...GOOD, reasoning: 'has } and { inside' } });
  });

  it('reports PARSE_FAILURE for an answer with no JSON object or an envelope without result', () => {
    expect(parseVerdictText('no json here')).toMatchObject({ kind: 'invalid', cause: 'PARSE_FAILURE' });
    expect(parseEnvelopeVerdict({ is_error: true })).toMatchObject({ kind: 'invalid', cause: 'PARSE_FAILURE' });
    expect(parseEnvelopeVerdict('text')).toMatchObject({ kind: 'invalid', cause: 'PARSE_FAILURE' });
  });

  it('parseVerdict (pre-Step-21 entry) is strict', () => {
    expect(parseVerdict(JSON.stringify(GOOD))).toEqual(GOOD);
    expect(parseVerdict(JSON.stringify({ pass: true, reasoning: 'r', evidence: [], violations: [] }))).toBeNull();
  });
});

describe('VRD-05 path normalisation', () => {
  const root = '/work/proj';
  it.each([
    ['./src/x.ts', 'src/x.ts'],
    ['src\\x.ts', 'src/x.ts'],
    ['.\\src\\x.ts', 'src/x.ts'],
    ['/work/proj/src/x.ts', 'src/x.ts'],
    ['src/./a/../x.ts', 'src/x.ts'],
    ['  src/x.ts ', 'src/x.ts'],
  ])('%s → %s', (raw, expected) => {
    expect(normaliseViolationPath(raw, root)).toBe(expected);
  });

  it.each(['../etc/passwd', '/etc/passwd', '/work/project-other/x.ts', 'src/../../x.ts', '', '.', './'])(
    'rejects %s',
    (raw) => {
      expect(normaliseViolationPath(raw, root)).toBeNull();
    },
  );

  it('accepts a root given with a trailing slash or backslashes', () => {
    expect(normaliseViolationPath('src/x.ts', '/work/proj/')).toBe('src/x.ts');
  });
});

describe('VRD-06 membership', () => {
  const unit = { filePaths: ['src/a.ts'] };
  it('keeps a member path (normalised) and drops a basename-only path', () => {
    const result = filterMembers(
      [
        { filePath: 'a.ts', message: 'basename' },
        { filePath: './src/a.ts', message: 'member' },
        { filePath: '../x.ts', message: 'outside' },
        { filePath: 'src/b.ts', message: 'other file' },
      ],
      unit,
      '/work/proj',
    );
    expect(result.kept).toEqual([{ filePath: 'src/a.ts', message: 'member' }]);
    expect(result.droppedNonMember).toBe(2);
    expect(result.droppedOutside).toBe(1);
  });
});
