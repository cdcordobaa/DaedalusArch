/**
 * U5b CI guards run by the existing scripts-project test step (`npm test`; `.github/**` untouched).
 * BR-U5b-56: no U5b commit adds or changes anything under `results/`. The check reads git history and fails (never
 * skips) when `origin/v1.2e` cannot be resolved. Build and Test re-scopes this guard when it commits registered results.
 */
import { execFileSync } from 'node:child_process';
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
