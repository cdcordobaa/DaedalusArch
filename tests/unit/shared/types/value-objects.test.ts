import { avrScore, ahsScore, confidence, commitSha, functionId, runId } from '../../../../src/shared/types/value-objects.js';

describe('AVRScore', () => {
  it('accepts 0', () => expect(avrScore(0)).toBe(0));
  it('accepts 1', () => expect(avrScore(1)).toBe(1));
  it('accepts 0.5', () => expect(avrScore(0.5)).toBe(0.5));
  it('throws below 0', () => expect(() => avrScore(-0.01)).toThrow(RangeError));
  it('throws above 1', () => expect(() => avrScore(1.01)).toThrow(RangeError));
});

describe('AHSScore', () => {
  it('accepts 0', () => expect(ahsScore(0)).toBe(0));
  it('accepts 1', () => expect(ahsScore(1)).toBe(1));
  it('throws below 0', () => expect(() => ahsScore(-0.1)).toThrow(RangeError));
  it('throws above 1', () => expect(() => ahsScore(1.1)).toThrow(RangeError));
});

describe('Confidence', () => {
  it('accepts 0.85', () => expect(confidence(0.85)).toBe(0.85));
  it('throws below 0', () => expect(() => confidence(-1)).toThrow(RangeError));
  it('throws above 1', () => expect(() => confidence(2)).toThrow(RangeError));
});

describe('CommitSha', () => {
  const validSha = 'a'.repeat(40);
  const validMixed = '0123456789abcdef'.repeat(2) + '01234567';

  it('accepts valid 40-char hex SHA', () => expect(commitSha(validSha)).toBe(validSha));
  it('accepts mixed-case hex', () => expect(commitSha(validMixed.toUpperCase())).toBeTruthy());
  it('throws on short SHA', () => expect(() => commitSha('abc')).toThrow(TypeError));
  it('throws on non-hex', () => expect(() => commitSha('g'.repeat(40))).toThrow(TypeError));
  it('throws on empty string', () => expect(() => commitSha('')).toThrow(TypeError));
});

describe('FunctionId and RunId', () => {
  it('wraps any string as FunctionId', () => expect(functionId('FF-S01')).toBe('FF-S01'));
  it('wraps any string as RunId', () => expect(runId('run-123')).toBe('run-123'));
});
