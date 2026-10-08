/**
 * U5b CI guards run by the existing scripts-project test step (`npm test`; `.github/**` untouched).
 * BR-U5b-56: no U5b commit adds or changes anything under `results/`. The check reads git history and fails (never
 * skips) when `origin/v1.2e` cannot be resolved. Build and Test re-scopes this guard when it commits registered results.
 * BR-U5b-44 (Step 28): no test under `tests/unit/scripts/**` constructs the live Gemini provider or imports its
 * constructor as a value; U5b tests label through Mock providers and cassettes only.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './score-fixture.js';

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

describe('results guard (BR-U5b-56)', () => {
  it('origin/v1.2e resolves and `git diff --name-only origin/v1.2e...HEAD -- results/` is empty', () => {
    expect(git('rev-parse', '--verify', 'origin/v1.2e^{commit}')).toMatch(/^[0-9a-f]{40}$/);
    expect(git('diff', '--name-only', 'origin/v1.2e...HEAD', '--', 'results/')).toBe('');
  });
});

/** Every `.ts` file under `dir` (recursive), repo-relative. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts')) out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out.sort();
}

/** Offending lines: a `new GeminiProvider` or a value import of `GeminiProvider` (type-only imports allowed). */
export function liveGeminiUses(file: string, text: string): string[] {
  const bad: string[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/\bnew\s+GeminiProvider\b/.test(line)) bad.push(`${file}:${String(i + 1)}: constructs GeminiProvider`);
  });
  for (const m of text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]*gemini-provider(?:\.js)?['"]/g)) {
    if (m[1] !== undefined) continue;
    const names = (m[2] ?? '').split(',').map((n) => n.trim()).filter((n) => n !== '');
    if (names.some((n) => /^GeminiProvider\b/.test(n))) bad.push(`${file}: value import of GeminiProvider`);
  }
  return bad;
}

describe('no live Gemini in the scripts tests (BR-U5b-44)', () => {
  const GUARD = 'tests/unit/scripts/u5b/guards.test.ts';

  it('no file under tests/unit/scripts/** constructs GeminiProvider or imports it as a value', () => {
    const files = tsFiles(join(ROOT, 'tests/unit/scripts')).filter((f) => f !== GUARD);
    expect(files.length).toBeGreaterThan(30);
    expect(files.flatMap((f) => liveGeminiUses(f, readFileSync(join(ROOT, f), 'utf8')))).toEqual([]);
  });

  it('flags a construction and a value import, and accepts a type-only import', () => {
    const ctor = ['new', 'GeminiProvider'].join(' ');
    expect(liveGeminiUses('x.ts', `const p = ${ctor}({ apiKey: '', model: 'm', temperature: 0, maxTokens: 1 });`)).toHaveLength(1);
    expect(liveGeminiUses('x.ts', "import { GeminiProvider } from '../../src/llm-critic/gemini-provider.js';")).toHaveLength(1);
    expect(liveGeminiUses('x.ts', "import type { GeminiProvider } from '../../src/llm-critic/gemini-provider.js';")).toEqual([]);
    expect(liveGeminiUses('x.ts', "import { toGeminiResponseSchema } from '../../src/llm-critic/gemini-provider.js';")).toEqual([]);
  });
});
