// U4 Step 20 (U4-K3): `parseLLMOptions` (DE §5.6; BR-U4-ISO-01 a/b, ISO-04, VRD-09, CAS-05,
// CAS-08, OPS-01; FR-23, FR-31; D-U0-8, D-U0-17).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expandHome, parseLLMOptions } from '../../../src/cli/llm-options.js';
import type { ParsedLLMOptions } from '../../../src/cli/llm-options.js';
import type { DomainResult } from '../../../src/shared/errors/domain-result.js';

const REPO = path.resolve(__dirname, '../../..');
const roots: string[] = [];
function tmpDir(prefix = 'u4-opts-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

/** A home dir outside any repository, so the default judge dir passes placement. */
const HOME = tmpDir('u4-home-');

function ok(result: DomainResult<ParsedLLMOptions>): ParsedLLMOptions {
  if (!result.success) throw new Error(`expected success: ${result.errors[0]?.message ?? ''}`);
  return result.data;
}
function errorOf(result: DomainResult<ParsedLLMOptions>): string {
  if (result.success) throw new Error('expected a configuration error');
  expect(result.errors[0]?.code).toBe('LLM_CONFIG_INVALID');
  return result.errors[0]?.message ?? '';
}

describe('parseLLMOptions defaults (DE §5.6, OPS-01)', () => {
  it('claude-cli, the pinned model, high effort, 8192 tokens, record into ./.firewall/cassettes', () => {
    const parsed = ok(parseLLMOptions([], {}, { homeDir: HOME }));
    expect(parsed.provider).toBe('claude-cli');
    expect(parsed.run.llm).toEqual({ model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 });
    expect(parsed.cassette).toEqual({ mode: 'record', dir: './.firewall/cassettes' });
    expect(parsed.run.cassette).toEqual({ mode: 'record', dir: './.firewall/cassettes', omitPrompt: false });
    expect(parsed.run.repetition).toBe(0);
    expect(parsed.run.baselineReport).toBeUndefined();
    expect(parsed.judgeConfigDir).toBe(path.join(HOME, '.firewall/judge-claude-config'));
    expect(parsed.claudeCli).toMatchObject({ binary: 'claude', model: 'claude-opus-5-5', effort: 'high', timeoutMs: 180000 });
    expect(parsed.gemini).toBeUndefined();
  });

  it('reads every option, in both --opt value and --opt=value forms, and ignores other arguments', () => {
    const parsed = ok(parseLLMOptions([
      'evaluate', '--spec', 'x.yaml', '--llm-effort=medium', '--cassette-mode', 'replay', '--cassette-dir', 'experiments/e1/cassettes',
      '--judge-repetition=2', '--judge-config-dir', '~/cfg', '--judge-baseline-report', 'base.json', '--cassette-omit-prompt',
    ], {}, { homeDir: HOME }));
    expect(parsed.run.llm.effort).toBe('medium');
    expect(parsed.run.cassette).toEqual({ mode: 'replay', dir: 'experiments/e1/cassettes', omitPrompt: true });
    expect(parsed.run.repetition).toBe(2);
    expect(parsed.run.baselineReport).toBe('base.json');
    expect(parsed.judgeConfigDir).toBe(path.join(HOME, 'cfg'));
  });

  it('--llm-provider mock is accepted with the judge model id', () => {
    const parsed = ok(parseLLMOptions(['--llm-provider', 'mock'], {}, { homeDir: HOME }));
    expect(parsed.provider).toBe('mock');
    expect(parsed.run.llm.model).toBe('claude-opus-5-5');
    expect(parsed.claudeCli).toBeUndefined();
  });

  it('expands ~ only at the start', () => {
    expect(expandHome('~', '/h')).toBe('/h');
    expect(expandHome('~/a/b', '/h')).toBe('/h/a/b');
    expect(expandHome('/abs/~x', '/h')).toBe('/abs/~x');
  });
});

describe('parseLLMOptions configuration errors', () => {
  it("'bypass' and unknown cassette modes are rejected (CAS-05)", () => {
    expect(errorOf(parseLLMOptions(['--cassette-mode', 'bypass'], {}, { homeDir: HOME }))).toContain('record or replay');
    expect(errorOf(parseLLMOptions(['--cassette-mode=none'], {}, { homeDir: HOME }))).toContain('record or replay');
  });

  it('unknown provider or effort, a bad repetition and a missing value are rejected', () => {
    expect(errorOf(parseLLMOptions(['--llm-provider', 'openai'], {}, { homeDir: HOME }))).toContain('--llm-provider');
    expect(errorOf(parseLLMOptions(['--llm-effort', 'extreme'], {}, { homeDir: HOME }))).toContain('--llm-effort');
    expect(errorOf(parseLLMOptions(['--judge-repetition', '-1'], {}, { homeDir: HOME }))).toContain('non-negative integer');
    expect(errorOf(parseLLMOptions(['--judge-repetition', '1.5'], {}, { homeDir: HOME }))).toContain('non-negative integer');
    expect(errorOf(parseLLMOptions(['--llm-model'], {}, { homeDir: HOME }))).toContain('needs a value');
    expect(errorOf(parseLLMOptions(['--cassette-omit-prompt=yes'], {}, { homeDir: HOME }))).toContain('takes no value');
  });

  it('VRD-09: Gemini without --llm-model is a configuration error', () => {
    expect(errorOf(parseLLMOptions(['--llm-provider', 'gemini'], { GEMINI_API_KEY: 'k' }, { homeDir: HOME }))).toContain('--llm-model');
  });

  it('ISO-01 b: an env holding only ANTHROPIC_API_KEY with gemini is a configuration error, never a Gemini config', () => {
    const result = parseLLMOptions(['--llm-provider', 'gemini', '--llm-model', 'gemini-pinned-id'], { ANTHROPIC_API_KEY: 'anthropic-only' }, { homeDir: HOME });
    expect(errorOf(result)).toContain('GEMINI_API_KEY');
  });

  it('Gemini with a key and a model: GEMINI_API_KEY is read, 8192 tokens', () => {
    const parsed = ok(parseLLMOptions(['--llm-provider', 'gemini', '--llm-model', 'gemini-pinned-id'], { GEMINI_API_KEY: 'gk' }, { homeDir: HOME }));
    expect(parsed.gemini).toEqual({ apiKey: 'gk', model: 'gemini-pinned-id', temperature: 0, maxTokens: 8192 });
    expect(parsed.run.llm.model).toBe('gemini-pinned-id');
  });

  it('GEMINI_API_KEY is not read for claude-cli or mock', () => {
    const env = new Proxy<NodeJS.ProcessEnv>({}, {
      get: (_t, key) => {
        if (key === 'GEMINI_API_KEY') throw new Error('GEMINI_API_KEY read');
        return undefined;
      },
    });
    expect(parseLLMOptions([], env, { homeDir: HOME }).success).toBe(true);
    expect(parseLLMOptions(['--llm-provider', 'mock'], env, { homeDir: HOME }).success).toBe(true);
  });

  it('ISO-04: a judge config dir inside the evaluated project or a git repository is refused', () => {
    const project = tmpDir('u4-project-');
    expect(errorOf(parseLLMOptions(['--judge-config-dir', path.join(project, 'cfg')], {}, { homeDir: HOME, projectRoot: project })))
      .toContain('inside the evaluated project');
    expect(errorOf(parseLLMOptions(['--judge-config-dir', path.join(REPO, '.firewall', 'judge')], {}, { homeDir: HOME })))
      .toContain('inside a git repository');
  });
});

describe('ISO-01 a and VRD-09 source checks', () => {
  function grep(pattern: string, paths: string[]): string {
    try {
      return execFileSync('grep', ['-rn', pattern, ...paths], { cwd: REPO, encoding: 'utf8' });
    } catch {
      return ''; // grep exits 1 when nothing matches
    }
  }

  it('no ANTHROPIC_API_KEY in src/llm-critic/ or src/cli/llm-options.ts', () => {
    expect(grep('ANTHROPIC_API_KEY', ['src/llm-critic/', 'src/cli/llm-options.ts'])).toBe('');
  });

  it('no gemini-2.0-flash default in the U4-owned sources', () => {
    expect(grep('gemini-2.0-flash', ['src/llm-critic/', 'src/cli/llm-options.ts'])).toBe('');
  });
});

describe('--judge-cli: the pinned judge binary under its own prefix (ADR-022 item 5; ADR-018 pin)', () => {
  const pinned = path.join(HOME, '.firewall/judge-cli/node_modules/.bin/claude');

  it('defaults to the private pinned binary when it exists, else to claude on PATH', () => {
    expect(ok(parseLLMOptions([], {}, { homeDir: HOME, exists: (f) => f === pinned })).claudeCli?.binary).toBe(pinned);
    expect(ok(parseLLMOptions([], {}, { homeDir: HOME, exists: () => false })).claudeCli?.binary).toBe('claude');
  });

  it('an explicit --judge-cli wins: a path is ~-expanded and resolved, a bare name is kept for PATH lookup', () => {
    expect(ok(parseLLMOptions(['--judge-cli', '~/bin/claude-2.1.294'], {}, { homeDir: HOME, exists: () => true })).claudeCli?.binary).toBe(path.join(HOME, 'bin/claude-2.1.294'));
    expect(ok(parseLLMOptions(['--judge-cli=claude'], {}, { homeDir: HOME, exists: () => true })).claudeCli?.binary).toBe('claude');
    expect(errorOf(parseLLMOptions(['--judge-cli'], {}, { homeDir: HOME }))).toContain('--judge-cli needs a value');
  });
});
