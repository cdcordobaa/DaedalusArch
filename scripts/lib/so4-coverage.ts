/**
 * SO4 seed coverage and the held-out N against the floor (ADR-021 SO4-03, SO4-05; ADR-019 item 1; BR-U5a-01, 37;
 * MAT-12 step 1, MAT-25).
 *
 * Pure functions over the scorer's output (`perInstance`, `rejectedPairs`, `manifestRejections`):
 * - `seedCoverageRows`: one row per seed of the case (its stage and status, or the reason it yields no score) and one
 *   row per manifest rejection (stage `mutate`; not an instance, counted in the coverage table only);
 * - `goldenNRows`: the golden-set count at each stage (in the manifest, rejected as a pair, not applicable, site
 *   invalid, scored) overall, per project and per style, and, on the overall row, the scored N against the registered
 *   80–120 floor with the ADR-019 item 1 shortfall statement.
 *
 * The golden set is the BR-U5a-01 set (`isGoldenRow`): held-out positive rows of a symbolic operator, no twins, no
 * judge probes. A scored instance is golden when its split is `held-out` and it is not a twin (judge-probe rows never
 * reach `perInstance`, and every other positive row has a symbolic dimension). N for the floor is `n_scored`, the
 * golden instances with status `matched` or `missed`, the denominator of held-out recall.
 */

/** The BR-U5a-37 floor and ceiling of the held-out golden total (`K_TARGET_MIN`, `K_TARGET_MAX`; a test keeps them equal). */
export const GOLDEN_FLOOR = 80;
export const GOLDEN_CEILING = 120;

/** The instance fields this module reads (a subset of `InstanceResult`). */
export interface CoverageInstance {
  readonly seedId: string;
  readonly projectId: string;
  readonly operatorId: string;
  readonly split: string;
  readonly baseKind: string;
  readonly dimension: string | null;
  readonly status: string;
  readonly specStyle?: string;
  readonly corpusStyle?: string;
}

/** The rejected-pair fields this module reads (a subset of `RejectedPair`). */
export interface CoverageRejectedPair {
  readonly seedId: string;
  readonly projectId: string;
  readonly operatorId: string;
  readonly split: string;
  readonly baseKind: string;
  readonly golden: boolean;
  /** The spec style of the row, when declared (absent on a score written before the field existed). */
  readonly specStyle?: string;
  readonly code: string;
  readonly reason: string;
}

export interface CoverageManifestRejection {
  readonly projectId: string;
  readonly operatorId: string;
  readonly reason: string;
  readonly detail: string;
}

export interface CoverageInput {
  readonly instances: readonly CoverageInstance[];
  readonly rejectedPairs: readonly CoverageRejectedPair[];
  readonly manifestRejections: readonly CoverageManifestRejection[];
  /** Corpus project id → corpus style (`corpus/corpus.json`), for rows the score has no style for. */
  readonly corpusStyles?: ReadonlyMap<string, string>;
}

export const SEED_COVERAGE_COLUMNS = [
  'plan_id', 'seed_id', 'project_id', 'operator_id', 'split', 'base_kind', 'corpus_style', 'spec_style', 'golden', 'stage', 'status', 'reason',
] as const;

const twin = (status: string): boolean => status === 'twin-clean' || status === 'twin-fired';

/** A scored instance of the golden set (BR-U5a-01, as it appears in `perInstance`). */
export function isGoldenInstance(i: Pick<CoverageInstance, 'split' | 'status' | 'dimension'>): boolean {
  return i.split === 'held-out' && !twin(i.status) && i.dimension !== null;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** `seed_coverage.csv` rows (without the CSV quoting): scored and rejected seeds by seed id, then the mutate rejections. */
export function seedCoverageRows(planId: string, input: CoverageInput): string[][] {
  const corpusStyle = (p: string, own?: string): string => own ?? input.corpusStyles?.get(p) ?? '';
  const seeds: string[][] = [
    ...input.instances.map((i) => [
      planId, i.seedId, i.projectId, i.operatorId, i.split, i.baseKind, corpusStyle(i.projectId, i.corpusStyle), i.specStyle ?? '',
      String(isGoldenInstance(i)), 'scored', i.status, '',
    ]),
    ...input.rejectedPairs.map((r) => [
      planId, r.seedId, r.projectId, r.operatorId, r.split, r.baseKind, corpusStyle(r.projectId), r.specStyle ?? '', String(r.golden), 'pair', 'rejected', `${r.code}: ${r.reason}`,
    ]),
  ].sort((a, b) => byText(a[1] ?? '', b[1] ?? ''));
  const mutate = input.manifestRejections.map((r) => [
    planId, '', r.projectId, r.operatorId, '', '', corpusStyle(r.projectId), '', '', 'mutate', 'rejected', `${r.reason}: ${r.detail}`,
  ]);
  return [...seeds, ...mutate];
}

export const GOLDEN_N_COLUMNS = [
  'plan_id', 'scope', 'key', 'n_golden', 'n_pair_rejected', 'n_not_applicable', 'n_site_invalid', 'n_scored', 'n_matched', 'n_missed',
  'n_mutate_rejected', 'n_registered', 'floor', 'ceiling', 'floor_met', 'shortfall', 'above_ceiling', 'statement',
] as const;

interface Tally { golden: number; pairRejected: number; notApplicable: number; siteInvalid: number; matched: number; missed: number }

const emptyTally = (): Tally => ({ golden: 0, pairRejected: 0, notApplicable: 0, siteInvalid: 0, matched: 0, missed: 0 });

/** The ADR-019 item 1 sentence for the overall row. */
export function floorStatement(nScored: number, nRegistered: number | undefined): string {
  const reg = nRegistered === undefined ? '' : ` Registered held-out golden total: ${String(nRegistered)}; ${String(Math.max(0, nRegistered - nScored))} of them yield no scored instance.`;
  if (nScored < GOLDEN_FLOOR) {
    return `N = ${String(nScored)} scored golden instances, ${String(GOLDEN_FLOOR - nScored)} below the floor of ${String(GOLDEN_FLOOR)}. `
      + 'Under ADR-019 item 1 the catalogue k stays frozen, SO4 is reported with the actual N, and the shortfall is a Ch7 deviation; no other lever is used.' + reg;
  }
  if (nScored > GOLDEN_CEILING) return `N = ${String(nScored)} scored golden instances, above the ceiling of ${String(GOLDEN_CEILING)} (BR-U5a-37).${reg}`;
  return `N = ${String(nScored)} scored golden instances, within the ${String(GOLDEN_FLOOR)}-${String(GOLDEN_CEILING)} floor (BR-U5a-37; ADR-019 item 1).${reg}`;
}

/**
 * `golden_instances.csv` rows: overall (with the floor columns and the statement), then per project, per spec style and
 * per corpus style (counts only). `nRegistered` is the catalogue's frozen held-out golden total, when given.
 */
export function goldenNRows(planId: string, input: CoverageInput, nRegistered?: number): string[][] {
  const scopes = new Map<string, Tally>();
  const tally = (scope: string, key: string): Tally => {
    const k = JSON.stringify([scope, key]);
    const t = scopes.get(k) ?? emptyTally();
    scopes.set(k, t);
    return t;
  };
  const keysOf = (projectId: string, specStyle: string | undefined, corpusStyle: string | undefined): [string, string][] => [
    ['overall', ''], ['project', projectId],
    ...(specStyle === undefined ? [] : [['spec_style', specStyle] as [string, string]]),
    ...(corpusStyle === undefined ? [] : [['corpus_style', corpusStyle] as [string, string]]),
  ];
  tally('overall', '');
  for (const i of input.instances) {
    if (!isGoldenInstance(i)) continue;
    for (const [scope, key] of keysOf(i.projectId, i.specStyle, i.corpusStyle ?? input.corpusStyles?.get(i.projectId))) {
      const t = tally(scope, key);
      t.golden += 1;
      if (i.status === 'matched') t.matched += 1;
      else if (i.status === 'missed') t.missed += 1;
      else if (i.status === 'not-applicable') t.notApplicable += 1;
      else if (i.status === 'site-invalid') t.siteInvalid += 1;
    }
  }
  for (const r of input.rejectedPairs) {
    if (!r.golden) continue;
    for (const [scope, key] of keysOf(r.projectId, r.specStyle, input.corpusStyles?.get(r.projectId))) {
      const t = tally(scope, key);
      t.golden += 1;
      t.pairRejected += 1;
    }
  }
  const order = ['overall', 'project', 'spec_style', 'corpus_style'];
  const entries = [...scopes.entries()].map(([k, t]) => [JSON.parse(k) as [string, string], t] as const)
    .sort(([[sa, ka]], [[sb, kb]]) => order.indexOf(sa) - order.indexOf(sb) || byText(ka, kb));
  return entries.map(([[scope, key], t]) => {
    const scored = t.matched + t.missed;
    const overall = scope === 'overall';
    return [
      planId, scope, key, String(t.golden), String(t.pairRejected), String(t.notApplicable), String(t.siteInvalid), String(scored),
      String(t.matched), String(t.missed),
      overall ? String(input.manifestRejections.length) : '', overall && nRegistered !== undefined ? String(nRegistered) : '',
      overall ? String(GOLDEN_FLOOR) : '', overall ? String(GOLDEN_CEILING) : '', overall ? String(scored >= GOLDEN_FLOOR) : '',
      overall ? String(Math.max(0, GOLDEN_FLOOR - scored)) : '', overall ? String(scored > GOLDEN_CEILING) : '',
      overall ? floorStatement(scored, nRegistered) : '',
    ];
  });
}
