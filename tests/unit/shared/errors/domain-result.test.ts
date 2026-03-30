import { DomainResult } from '../../../../src/shared/errors/domain-result.js';

describe('DomainResult.ok', () => {
  it('returns success:true with data', () => {
    const r = DomainResult.ok(42);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(42);
  });

  it('includes warnings when provided', () => {
    const w = [{ code: 'W1', message: 'warn' }];
    const r = DomainResult.ok('hello', w);
    expect(r.success).toBe(true);
    if (r.success) expect(r.warnings).toEqual(w);
  });

  it('omits warnings field when not provided', () => {
    const r = DomainResult.ok('hello');
    expect('warnings' in r).toBe(false);
  });
});

describe('DomainResult.fail', () => {
  it('returns success:false with errors', () => {
    const r = DomainResult.fail([{ code: 'E1', message: 'error' }]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors).toHaveLength(1);
  });

  it('throws if errors array is empty', () => {
    expect(() => DomainResult.fail([])).toThrow('at least one error');
  });
});

describe('DomainResult.fromError', () => {
  it('wraps an Error instance', () => {
    const r = DomainResult.fromError<string>(new Error('boom'));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.message).toBe('boom');
  });

  it('wraps a non-Error string', () => {
    const r = DomainResult.fromError<string>('something went wrong');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.message).toBe('something went wrong');
  });
});
