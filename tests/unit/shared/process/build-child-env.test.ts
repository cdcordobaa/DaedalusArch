/**
 * buildChildEnv (U0 Step 28, NFR-08): allow-listed, defined, case-sensitive,
 * frozen copy; the parent environment is never mutated.
 */
import { buildChildEnv } from '../../../../src/shared/process/node-process-runner.js';

function parentEnv(): NodeJS.ProcessEnv {
  return {
    ANTHROPIC_API_KEY: 'sk-ant-test-key',
    NEO4J_PASSWORD: 'test-password',
    GEMINI_API_KEY: 'AIza-test-key',
    PATH: '/usr/bin:/bin',
  };
}

describe('buildChildEnv', () => {
  it('copies only the allowed names', () => {
    expect(buildChildEnv(parentEnv(), ['PATH'])).toEqual({ PATH: '/usr/bin:/bin' });
  });

  it('omits an allowed name that is not defined in the parent', () => {
    const env = buildChildEnv(parentEnv(), ['PATH', 'HOME']);
    expect(env).toEqual({ PATH: '/usr/bin:/bin' });
    expect('HOME' in env).toBe(false);
  });

  it('omits an allowed name whose value is undefined', () => {
    const parent: NodeJS.ProcessEnv = { PATH: '/bin', HOME: undefined };
    expect(buildChildEnv(parent, ['PATH', 'HOME'])).toEqual({ PATH: '/bin' });
  });

  it('keeps an allowed name whose value is the empty string', () => {
    expect(buildChildEnv({ EMPTY: '' }, ['EMPTY'])).toEqual({ EMPTY: '' });
  });

  it('returns a frozen object', () => {
    const env = buildChildEnv(parentEnv(), ['PATH']);
    expect(Object.isFrozen(env)).toBe(true);
    expect(() => {
      (env as Record<string, string>).EXTRA = 'x';
    }).toThrow(TypeError);
  });

  it('never mutates the parent', () => {
    const parent = parentEnv();
    const before = { ...parent };
    const env = buildChildEnv(parent, ['PATH', 'NEO4J_PASSWORD']);
    expect(parent).toEqual(before);
    expect(env).not.toBe(parent);
  });

  it('matches names case-sensitively', () => {
    expect(buildChildEnv(parentEnv(), ['path', 'Path', 'anthropic_api_key'])).toEqual({});
    expect(buildChildEnv({ Path: 'C:\\Windows' }, ['PATH'])).toEqual({});
  });

  it('returns an empty frozen object for an empty allow-list', () => {
    const env = buildChildEnv(parentEnv(), []);
    expect(env).toEqual({});
    expect(Object.isFrozen(env)).toBe(true);
  });
});
