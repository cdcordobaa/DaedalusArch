/**
 * Build and Test Step 6: triaged dependency-audit gate (NFR-06, SECURITY-10).
 */
import { advisoryId, blockingAdvisories, loadAllowlist, main, untriaged } from '../../../../scripts/audit-gate.js';
import { ROOT } from './score-fixture.js';

const via = (name: string, severity: string, ghsa: string): Record<string, string> =>
  ({ name, severity, title: `${name} advisory`, url: `https://github.com/advisories/${ghsa}` });

const AUDIT = {
  vulnerabilities: {
    braces: { via: [via('braces', 'high', 'GHSA-vfj7-8cjw-p6xm')] },
    micromatch: { via: ['braces'] },
    'js-yaml': { via: [via('js-yaml', 'moderate', 'GHSA-mod0-0000-0000')] },
    other: { via: [via('other', 'critical', 'GHSA-crit-0000-0000'), via('other', 'high', 'GHSA-crit-0000-0000')] },
  },
};

describe('audit gate (NFR-06)', () => {
  it('collects high and critical root advisories once each, ignoring chains and moderates', () => {
    expect(advisoryId('https://github.com/advisories/GHSA-abcd-efgh-ijkl')).toBe('GHSA-abcd-efgh-ijkl');
    expect(blockingAdvisories(AUDIT).map((a) => a.id)).toEqual(['GHSA-crit-0000-0000', 'GHSA-vfj7-8cjw-p6xm']);
    expect(() => blockingAdvisories({})).toThrow(/npm audit/);
  });

  it('the committed allow-list is well formed and covers braces only', () => {
    const allow = loadAllowlist(ROOT);
    expect(allow.map((e) => e.id)).toEqual(['GHSA-vfj7-8cjw-p6xm']);
    expect(untriaged(blockingAdvisories(AUDIT), allow).map((a) => a.id)).toEqual(['GHSA-crit-0000-0000']);
  });

  it('CLI: exit 0 when every advisory is triaged, 1 on an untriaged one, 2 on bad input; --self-test exits 1', async () => {
    let err = '';
    const io = (audit: unknown) => ({ out: (): void => undefined, err: (t: string): void => { err += t; }, audit: () => JSON.stringify(audit) });
    expect(await main([], ROOT, io({ vulnerabilities: { braces: AUDIT.vulnerabilities.braces } }))).toBe(0);
    expect(await main([], ROOT, io(AUDIT))).toBe(1);
    expect(err).toMatch(/AUDIT_UNTRIAGED: critical other GHSA-crit-0000-0000/);
    expect(await main([], ROOT, { ...io({}), audit: () => 'not json' })).toBe(2);
    expect(await main(['--self-test'], ROOT, io({}))).toBe(1);
  });
});
