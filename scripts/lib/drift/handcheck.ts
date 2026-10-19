/**
 * The C1e hand-check packet (T-HC of `aidlc-docs/construction/v1.4/U4/functional-design/design.md` §5; the C1e part
 * test of `ops/04-north-star.md`): a seeded, stratified sample of real pair-level disappearances for the author to
 * label ("same violation?", "cause right?"). The module produces the packet; it never fills the labels (Q9). Pure.
 *
 * Stratified by cause in the taxonomy order, up to `perCause` rows each, sampled with `seededRandom` and
 * `sampleWithout` of `scripts/v1.3/lib/fixes-mined.ts`. Only valid pairs, and FF-S02 rows at the cap are left out
 * (ID-19). Blocking findings only unless `tier` says otherwise.
 */
import { sampleWithout, seededRandom } from '../../v1.3/lib/fixes-mined.js';
import { DISAPPEARANCE_CAUSES, type MinedPairRecord } from './metrics.js';

export interface HandcheckRepo {
  readonly id: string;
  /** `owner/name` on GitHub, for the commit link. */
  readonly repo: string;
  readonly pairs: readonly MinedPairRecord[];
}

export interface HandcheckRow {
  readonly repoId: string;
  readonly repo: string;
  readonly commit: string;
  readonly parent: string;
  readonly link: string;
  readonly date: string;
  readonly rule: string;
  readonly tier: string;
  readonly files: string;
  readonly target: string;
  readonly key: string;
  readonly cause: string;
  /** Empty: the author's label. */
  readonly sameViolation: '';
  /** Empty: the author's label. */
  readonly causeRight: '';
}

export interface HandcheckOptions {
  readonly seed: number;
  readonly perCause: number;
  readonly tier?: 'blocking' | 'advisory' | 'all' | undefined;
  readonly s02Cap?: number | undefined;
}

export function handcheckSample(repos: readonly HandcheckRepo[], opts: HandcheckOptions): HandcheckRow[] {
  const cap = opts.s02Cap ?? 100;
  const tier = opts.tier ?? 'blocking';
  const pools = new Map<string, HandcheckRow[]>(DISAPPEARANCE_CAUSES.map((c) => [c, []]));
  for (const r of repos) {
    for (const p of r.pairs) {
      if (!(p.parentOk && p.childOk)) continue;
      const trunc = (p.exposedByRule['FF-S02'] ?? 0) >= cap || (p.childByRule['FF-S02'] ?? 0) >= cap;
      for (const f of p.disappeared) {
        if (tier !== 'all' && f.tier !== tier) continue;
        if (f.functionId === 'FF-S02' && trunc) continue;
        const cause = f.cause ?? 'OTHER';
        const pool = pools.get(cause) ?? [];
        pool.push({
          repoId: r.id, repo: r.repo, commit: p.sha, parent: p.parent, link: `https://github.com/${r.repo}/commit/${p.sha}`,
          date: p.date, rule: f.functionId, tier: f.tier, files: f.filePath, target: f.target ?? '', key: f.key, cause,
          sameViolation: '', causeRight: '',
        });
        pools.set(cause, pool);
      }
    }
  }
  const rnd = seededRandom(opts.seed);
  const out: HandcheckRow[] = [];
  for (const [, pool] of pools) out.push(...sampleWithout(pool, opts.perCause, rnd));
  return out;
}

const HEADER: readonly (keyof HandcheckRow)[] = ['repoId', 'repo', 'commit', 'parent', 'link', 'date', 'rule', 'tier', 'files', 'target', 'key', 'cause', 'sameViolation', 'causeRight'];
const cell = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The packet as CSV (RFC 4180 quoting), the two label columns empty. */
export function handcheckCsv(rows: readonly HandcheckRow[]): string {
  return [HEADER.join(','), ...rows.map((r) => HEADER.map((h) => cell(r[h])).join(','))].join('\n') + '\n';
}
