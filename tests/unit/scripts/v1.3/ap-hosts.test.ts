/**
 * Anti-pattern host projects (`fixtures/unit/ap-hosts/`, `Docs/v1.3/ap-hosts-notes.md`). Each host compiles with plain
 * tsc and its vendored typings, offers at least `MIN_SITES_PER_OPERATOR` eligible sites to every seeded operator and
 * its twin (the frozen operators' own site pass, `eligibleSites`), has no blocking finding of the static clean-base
 * check (`lintHost`), and a seeded draw of every operator adds no diagnostic. The frozen operator files still hash as
 * recorded in `Docs/v1.3/judge-catch-frozen.md`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { smokeBase } from '../../../../scripts/antipattern-sites.js';
import { ANTIPATTERN_OPERATORS } from '../../../../scripts/lib/mutation/antipatterns/index.js';
import { AP_HOSTS, MIN_SITES_PER_OPERATOR, SEEDED_PAIRS, hostSiteTable, twinOrder } from '../../../../scripts/v1.3/ap-hosts-seed.js';
import { typecheck } from '../../../../scripts/v1.3/judge-catch-seed.js';
import { lintHost } from '../../../../scripts/v1.3/lib/ap-hosts-lint.js';
import type { LintRow } from '../../../../scripts/v1.3/lib/ap-hosts-lint.js';

jest.setTimeout(600_000);

const REPO = path.resolve(__dirname, '../../../..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sourceFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
}

/**
 * Advisory rows each host is known to have. The hexagonal host's use cases are imported by one inbound adapter each
 * and its composition root wires every adapter, as in the v1.3 hexagonal reference project; coupling metrics are
 * advisory there too (`tests/fixtures/v1.3-reference/hexagonal/reference.json`, `outOfScope`).
 */
const ADVISORY: Readonly<Record<string, readonly string[]>> = {
  'museum-loans': [],
  'coworking-memberships': [],
  'blood-drives': [],
  'translation-jobs': [
    'component-instability src/adapters/inbound/http/jobs.controller.ts',
    'component-instability src/application/use-cases/accept-quote.use-case.ts',
    'component-instability src/application/use-cases/assign-translator.use-case.ts',
    'component-instability src/application/use-cases/request-quote.use-case.ts',
    'component-instability src/application/use-cases/review-delivery.use-case.ts',
    'component-instability src/config/main.ts',
    'module-fan-out src/config/main.ts',
  ],
};

describe.each(AP_HOSTS.map((h) => [h.id, h] as const))('ap-host %s', (_id, host) => {
  const dir = path.join(REPO, host.dir);

  it('has 25 to 45 source files and compiles with plain tsc', () => {
    const n = sourceFiles(path.join(dir, 'src')).length;
    expect(n).toBeGreaterThanOrEqual(25);
    expect(n).toBeLessThanOrEqual(45);
    expect(typecheck(REPO, dir)).toEqual([]);
  });

  it(`offers at least ${String(MIN_SITES_PER_OPERATOR)} eligible sites to every seeded operator and twin`, async () => {
    const { rows } = await hostSiteTable(REPO, host);
    for (const { positive, twin } of SEEDED_PAIRS) {
      for (const op of [positive, twin]) {
        const row = rows.find((r) => r.operatorId === op.id);
        expect({ op: op.id, ok: (row?.eligible ?? 0) >= MIN_SITES_PER_OPERATOR }).toEqual({ op: op.id, ok: true });
      }
    }
  });

  it('has no blocking finding of the clean-base check, and only the pinned advisory rows', async () => {
    const rows = await lintHost(REPO, dir, host.specPath);
    const show = (r: LintRow): string => `${r.rule} ${r.file}`;
    expect(rows.filter((r) => r.blocking).map((r) => `${show(r)}: ${r.detail}`)).toEqual([]);
    expect(rows.filter((r) => !r.blocking).map(show)).toEqual(ADVISORY[host.id]);
  });

  it('applies two eligible sites of every operator without a new diagnostic', async () => {
    const r = await smokeBase(REPO, { projectId: host.id, kind: 'fixture', dir, tsconfigPath: 'tsconfig.json', specPath: host.specPath, commit: '0'.repeat(40) }, ANTIPATTERN_OPERATORS, 2);
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    expect(r.data.map((s) => ({ op: s.operatorId, applied: s.applied, broken: s.newDiagnostics, errors: s.applyErrors }))).toEqual(
      ANTIPATTERN_OPERATORS.map((o) => ({ op: o.id, applied: 2, broken: 0, errors: 0 })),
    );
  });
});

describe('twin pairing', () => {
  const site = (filePath: string, detail: Record<string, string>) => ({ filePath, line: 1, kind: 'rule-move' as const, detail });

  it('pairs a shared-site twin only with the same site', () => {
    const s = site('a.ts', { class: 'A', method: 'm' });
    expect(twinOrder('AP-REPO-BYPASS', s, [site('a.ts', { class: 'A', method: 'n' }), site('a.ts', { class: 'A', method: 'm' })]).map((t) => t.match)).toEqual(['same-site']);
  });

  it('ranks AP-FAT-CONTROLLER twins by call, handler, file, then host', () => {
    const seed = site('c.ts', { controller: 'C', handler: 'h', call: '0' });
    const twins = [site('d.ts', { controller: 'D', handler: 'h', call: '0' }), site('c.ts', { controller: 'C', handler: 'g', call: '0' }), site('c.ts', { controller: 'C', handler: 'h', call: '1' }), site('c.ts', { controller: 'C', handler: 'h', call: '0' })];
    expect(twinOrder('AP-FAT-CONTROLLER', seed, twins).map((t) => t.match)).toEqual(['same-call', 'same-handler', 'same-file', 'same-host']);
  });
});

describe('frozen operators', () => {
  it('every file hashed in Docs/v1.3/judge-catch-frozen.md still has its latest recorded sha256', () => {
    const doc = fs.readFileSync(path.join(REPO, 'Docs/v1.3/judge-catch-frozen.md'), 'utf8');
    const latest = new Map<string, string>();
    for (const m of doc.matchAll(/\| `([^`]+)` \| `([0-9a-f]{64})` \|/g)) latest.set(m[1] ?? '', m[2] ?? '');
    expect(latest.size).toBeGreaterThanOrEqual(20);
    for (const [file, sha] of latest) {
      expect({ file, sha: createHash('sha256').update(fs.readFileSync(path.join(REPO, file))).digest('hex') }).toEqual({ file, sha });
    }
  });
});
