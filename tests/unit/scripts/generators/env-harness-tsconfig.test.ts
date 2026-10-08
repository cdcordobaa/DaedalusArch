/**
 * Generator child environment and pinned harness tsconfig (U5a plan Step 17; BR-U5a-42, 44; NFR-v1.2E-08).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { harnessTsconfigPath } from '../../../../scripts/lib/generators/argv.js';
import {
  GENERATOR_ENV_ALLOW,
  GENERATOR_ENV_DENY,
  buildGeneratorChildEnv,
  isDeniedGeneratorVar,
} from '../../../../scripts/lib/generators/env.js';
import {
  buildHarnessTsconfig,
  harnessTscLauncherText,
  writeHarnessTscLauncher,
  writeHarnessTsconfig,
} from '../../../../scripts/lib/generators/harness-tsconfig.js';

describe('buildGeneratorChildEnv (BR-U5a-44)', () => {
  const parent: NodeJS.ProcessEnv = {
    HOME: '/home/u',
    USER: 'u',
    PATH: '/usr/bin:/bin',
    LANG: 'en_GB.UTF-8',
    TMPDIR: '/tmp/x',
    ANTHROPIC_API_KEY: 'sk-test-not-real',
    ANTHROPIC_AUTH_TOKEN: 'tok',
    CLAUDE_CODE_USE_BEDROCK: '1',
    CLAUDE_CODE_USE_VERTEX: '1',
    GITHUB_TOKEN: 'gh',
    NPM_TOKEN: 'npm',
    AWS_SECRET_ACCESS_KEY: 'aws',
    NEO4J_PASSWORD: 'pw',
    NODE_OPTIONS: '--inspect',
  };

  it('the allow-list is exactly the BR-U5a-44 list', () => {
    expect(GENERATOR_ENV_ALLOW).toEqual(['HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR']);
    expect(Object.isFrozen(GENERATOR_ENV_ALLOW)).toBe(true);
  });

  it('keeps exactly the allow-listed keys present in the parent and drops every credential', () => {
    const env = buildGeneratorChildEnv(parent);
    expect(Object.keys(env).sort()).toEqual(['HOME', 'LANG', 'PATH', 'TMPDIR', 'USER']);
    expect(env.HOME).toBe('/home/u');
    for (const name of [...GENERATOR_ENV_DENY, 'GITHUB_TOKEN', 'NPM_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'NEO4J_PASSWORD']) {
      expect(env).not.toHaveProperty(name);
    }
    expect(Object.isFrozen(env)).toBe(true);
    expect(parent.ANTHROPIC_API_KEY).toBe('sk-test-not-real');
  });

  it('removes denied names even when a caller widens the allow-list', () => {
    const env = buildGeneratorChildEnv(parent, [...GENERATOR_ENV_ALLOW, 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'NODE_OPTIONS']);
    expect(env).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(env).not.toHaveProperty('GITHUB_TOKEN');
    expect(env.NODE_OPTIONS).toBe('--inspect');
  });

  it('the deny predicate covers the named variables and *_TOKEN / *_KEY', () => {
    expect(isDeniedGeneratorVar('CLAUDE_CODE_USE_VERTEX')).toBe(true);
    expect(isDeniedGeneratorVar('MY_API_KEY')).toBe(true);
    expect(isDeniedGeneratorVar('some_token')).toBe(true);
    expect(isDeniedGeneratorVar('KEYBOARD')).toBe(false);
    expect(isDeniedGeneratorVar('PATH')).toBe(false);
  });

  it('an empty parent gives an empty env', () => {
    expect(buildGeneratorChildEnv({})).toEqual({});
  });
});

describe('harness tsconfig and launcher (BR-U5a-42)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-harness-'));
  });
  afterEach(() => {
    for (const f of [path.join(tmp, 'h', 'bin', 'tsc')]) if (fs.existsSync(f)) fs.chmodSync(f, 0o755);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('equals the pinned object with <cwd> substituted (deep equality)', () => {
    expect(buildHarnessTsconfig('/gen/out/m/task-management/none/run-0')).toEqual({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        incremental: false,
        typeRoots: ['/gen/out/m/task-management/none/run-0/node_modules/@types'],
        types: ['node'],
      },
      include: ['/gen/out/m/task-management/none/run-0/src/**/*.ts'],
    });
  });

  it('typeRoots and include are absolute; a trailing slash is normalised; a relative cwd is refused', () => {
    const t = buildHarnessTsconfig('/c/');
    expect(path.isAbsolute(t.compilerOptions.typeRoots[0])).toBe(true);
    expect(path.isAbsolute(t.include[0])).toBe(true);
    expect(t.include).toEqual(['/c/src/**/*.ts']);
    expect(() => buildHarnessTsconfig('rel')).toThrow(/absolute/);
  });

  it('writes <H>/runs/<runId>/tsconfig.json with the pinned content, rewritable', () => {
    const h = path.join(tmp, 'h');
    const cwd = path.join(tmp, 'out', 'run-0');
    const runId = 'm/task-management/none/run-0';
    const file = writeHarnessTsconfig(h, runId, cwd);
    expect(file).toBe(harnessTsconfigPath(h, runId));
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(buildHarnessTsconfig(cwd));
    expect(writeHarnessTsconfig(h, runId, cwd)).toBe(file);
  });

  it('writes a read-only <H>/bin/tsc launcher that runs the given tsc.js', () => {
    const h = path.join(tmp, 'h');
    const tscJs = path.resolve('node_modules/typescript/lib/tsc.js');
    const file = writeHarnessTscLauncher(h, tscJs, process.execPath);
    expect(file).toBe(path.join(h, 'bin', 'tsc'));
    expect(fs.statSync(file).mode & 0o777).toBe(0o555);
    expect(fs.readFileSync(file, 'utf8')).toBe(harnessTscLauncherText(tscJs, process.execPath));
    expect(execFileSync(file, ['--version'], { encoding: 'utf8' })).toMatch(/^Version \d+\.\d+\.\d+/);
    expect(writeHarnessTscLauncher(h, tscJs, process.execPath)).toBe(file);
    expect(() => writeHarnessTscLauncher(h, 'tsc.js', process.execPath)).toThrow(/absolute/);
  });

  it('the launcher quotes paths with spaces and quotes', () => {
    expect(harnessTscLauncherText("/a b/it's/tsc.js", '/n o/node')).toBe(
      "#!/bin/sh\nexec '/n o/node' '/a b/it'\\''s/tsc.js' \"$@\"\n",
    );
  });
});
