/**
 * Ontology v0 scorer: compares a run's derived findings with a case's `expected-semantic.json` (written before any
 * run), and puts the cheap proxies' and the judge's outcome on the same items beside it.
 *
 * Matching: a site reference matches a code site with the same file and class, and the same method when the reference
 * names one. A rule duplication or concept fragmentation matches when its sites cover every referenced site; a
 * misplaced responsibility matches on its site and, when the manifest names one, the natural layer. A forbidden item is
 * hit by any finding of its kind that covers it. Findings that match no expected item are `unexpected`.
 */
import type { APGResult } from '../../shared/types/apg.js';
import type { CheapEnrichment } from '../cheap/types.js';
import type { CodeSite, OntologyFinding, OntologyResult } from './types.js';

export interface SiteRef {
  readonly file: string;
  readonly class: string;
  readonly method?: string;
}

export type FindingKind = 'ruleDuplications' | 'misplacedResponsibilities' | 'conceptFragmentations' | 'capabilityScatter';
export const FINDING_KINDS: readonly FindingKind[] = ['ruleDuplications', 'misplacedResponsibilities', 'conceptFragmentations', 'capabilityScatter'];

const KIND_OF: Readonly<Record<OntologyFinding['kind'], FindingKind>> = {
  'semantic-rule-duplication': 'ruleDuplications',
  'misplaced-responsibility': 'misplacedResponsibilities',
  'concept-fragmentation': 'conceptFragmentations',
  'capability-scatter': 'capabilityScatter',
};

export interface ExpectedItem {
  readonly id?: string;
  readonly sites?: readonly SiteRef[];
  readonly classes?: readonly SiteRef[];
  readonly file?: string;
  readonly class?: string;
  readonly method?: string;
  readonly naturalLayer?: string;
}

export interface ExpectedSemanticManifest {
  readonly schemaVersion: 1;
  readonly case: string;
  readonly planted: string;
  readonly description?: string;
  readonly expect: Readonly<Record<FindingKind, readonly ExpectedItem[]>>;
  readonly forbid: Readonly<Record<FindingKind, readonly ExpectedItem[]>>;
}

/** A judge outcome on a case: the files of the units the judge failed (majority verdict). */
export interface JudgeCaseOutcome {
  readonly source: string;
  readonly failedFiles: readonly string[];
}

export type OntologyOutcome = 'found' | 'missed' | 'forbidden-hit' | 'clear';
export type OtherOutcome = 'caught' | 'missed' | 'flagged' | 'clear' | 'not-recorded';

export interface ItemScore {
  readonly kind: FindingKind;
  readonly id: string;
  readonly polarity: 'expected' | 'forbidden';
  readonly ontology: OntologyOutcome;
  readonly cheap: OtherOutcome;
  readonly judge: OtherOutcome;
}

export interface KindCounts {
  readonly expected: number;
  readonly found: number;
  readonly forbidden: number;
  readonly forbiddenHits: number;
  readonly unexpected: number;
}

export interface CaseScore {
  readonly case: string;
  readonly planted: string;
  readonly items: readonly ItemScore[];
  readonly counts: Readonly<Record<FindingKind, KindCounts>>;
  readonly unexpectedFindings: readonly OntologyFinding[];
  readonly hallucinations: number;
  readonly acceptedAssertions: number;
}

function refMatches(ref: SiteRef, s: CodeSite): boolean {
  return ref.file === s.file && ref.class === s.className && (ref.method === undefined || ref.method === s.methodName);
}

function covers(sites: readonly CodeSite[], refs: readonly SiteRef[]): boolean {
  return refs.length > 0 && refs.every((r) => sites.some((s) => refMatches(r, s)));
}

function sitesOf(f: OntologyFinding): readonly CodeSite[] {
  switch (f.kind) {
    case 'semantic-rule-duplication': return f.sites;
    case 'misplaced-responsibility': return [f.site];
    case 'concept-fragmentation': return f.classes;
    case 'capability-scatter': return f.classes;
  }
}

function refsOf(item: ExpectedItem): SiteRef[] {
  if (item.sites !== undefined) return [...item.sites];
  if (item.classes !== undefined) return [...item.classes];
  if (item.file !== undefined && item.class !== undefined) return [{ file: item.file, class: item.class, ...(item.method !== undefined ? { method: item.method } : {}) }];
  return [];
}

export function findingMatches(f: OntologyFinding, item: ExpectedItem): boolean {
  if (!covers(sitesOf(f), refsOf(item))) return false;
  if (f.kind === 'misplaced-responsibility' && item.naturalLayer !== undefined) return f.naturalLayer === item.naturalLayer;
  return true;
}

function itemId(item: ExpectedItem, i: number): string {
  const refs = refsOf(item);
  return item.id ?? (refs.length > 0 ? refs.map((r) => `${r.class}${r.method !== undefined ? `.${r.method}` : ''}`).join('+') : String(i));
}

// ── Cheap proxies on the same items ──────────────────────────────────────────────────────────────────────────────

const ROLE_PROXIES = new Set(['logic-density', 'name-behaviour', 'repo-bypass', 'framework-in-core', 'cohesion']);
const RELATION_PROXIES = new Set(['clones', 'shared-literals', 'vocabulary']);

/** Whether the cheap proxies signal the item: the relation (duplication, fragmentation) or the role (misplacement). */
export function cheapOutcome(kind: FindingKind, item: ExpectedItem, cheap: CheapEnrichment, apg: APGResult): boolean {
  const refs = refsOf(item);
  if (kind === 'misplacedResponsibilities') {
    return cheap.flags.some((f) => ROLE_PROXIES.has(f.proxy) && refs.some((r) => f.evidence.file === r.file && (f.className === undefined || f.className === r.class)));
  }
  const methodIds = new Set(apg.nodes.filter((n) => n.type === 'Method' && refs.some((r) => r.file === n.filePath && n.name.startsWith(`${r.class}.`) && (r.method === undefined || n.name === `${r.class}.${r.method}`))).map((n) => n.id));
  if (cheap.edges.some((e) => e.type === 'SAME_LOGIC_AS' && methodIds.has(e.sourceId) && methodIds.has(e.targetId))) return true;
  const flagged = refs.filter((r) => cheap.flags.some((f) => RELATION_PROXIES.has(f.proxy) && f.evidence.file === r.file && (f.className === undefined || f.className === r.class)));
  return flagged.length >= 2;
}

function judgeOutcomeOf(item: ExpectedItem, judge: JudgeCaseOutcome | undefined): boolean | null {
  if (judge === undefined) return null;
  return refsOf(item).some((r) => judge.failedFiles.includes(r.file));
}

export function scoreCase(manifest: ExpectedSemanticManifest, result: OntologyResult, ctx: { readonly cheap?: CheapEnrichment; readonly apg?: APGResult; readonly judge?: JudgeCaseOutcome } = {}): CaseScore {
  const items: ItemScore[] = [];
  const counts = {} as Record<FindingKind, KindCounts>;
  const matchedFindings = new Set<OntologyFinding>();
  const unexpectedFindings: OntologyFinding[] = [];
  for (const kind of FINDING_KINDS) {
    const found = result.findings.filter((f) => KIND_OF[f.kind] === kind);
    const expected = manifest.expect[kind];
    const forbidden = manifest.forbid[kind];
    let nFound = 0;
    let nHits = 0;
    const score = (item: ExpectedItem, i: number, polarity: ItemScore['polarity']): void => {
      const hits = found.filter((f) => findingMatches(f, item));
      if (polarity === 'expected') for (const h of hits) matchedFindings.add(h);
      const ontology: OntologyOutcome = polarity === 'expected' ? (hits.length > 0 ? 'found' : 'missed') : hits.length > 0 ? 'forbidden-hit' : 'clear';
      if (ontology === 'found') nFound++;
      if (ontology === 'forbidden-hit') nHits++;
      const cheapHit = ctx.cheap !== undefined && ctx.apg !== undefined ? cheapOutcome(kind, item, ctx.cheap, ctx.apg) : null;
      const judgeHit = judgeOutcomeOf(item, ctx.judge);
      const other = (hit: boolean | null): OtherOutcome => hit === null ? 'not-recorded' : polarity === 'expected' ? (hit ? 'caught' : 'missed') : hit ? 'flagged' : 'clear';
      items.push({ kind, id: itemId(item, i), polarity, ontology, cheap: other(cheapHit), judge: other(judgeHit) });
    };
    expected.forEach((it, i) => { score(it, i, 'expected'); });
    forbidden.forEach((it, i) => { score(it, i, 'forbidden'); });
    const unexpected = found.filter((f) => !matchedFindings.has(f));
    unexpectedFindings.push(...unexpected);
    counts[kind] = { expected: expected.length, found: nFound, forbidden: forbidden.length, forbiddenHits: nHits, unexpected: unexpected.length };
  }
  const accepted = Object.values(result.acceptedAssertions).reduce((a, b) => a + b, 0);
  return { case: manifest.case, planted: manifest.planted, items, counts, unexpectedFindings, hallucinations: result.hallucinations.length, acceptedAssertions: accepted };
}

export interface AggregateScore {
  readonly cases: number;
  readonly expected: number;
  readonly found: number;
  readonly recall: number | null;
  readonly forbidden: number;
  readonly forbiddenHits: number;
  readonly unexpected: number;
  /** found / (found + unexpected): every finding outside the manifests counts against it. */
  readonly precision: number | null;
  readonly cheapCaughtExpected: number;
  readonly cheapFlaggedForbidden: number;
  readonly judgeRecorded: number;
  readonly hallucinations: number;
  readonly acceptedAssertions: number;
  /** hallucinations / (hallucinations + accepted assertions). */
  readonly hallucinationRate: number | null;
}

export function aggregate(scores: readonly CaseScore[]): AggregateScore {
  let expected = 0; let found = 0; let forbidden = 0; let forbiddenHits = 0; let unexpected = 0;
  for (const s of scores) {
    for (const k of FINDING_KINDS) {
      const c = s.counts[k];
      expected += c.expected; found += c.found; forbidden += c.forbidden; forbiddenHits += c.forbiddenHits; unexpected += c.unexpected;
    }
  }
  const items = scores.flatMap((s) => s.items);
  const hallucinations = scores.reduce((a, s) => a + s.hallucinations, 0);
  const acceptedAssertions = scores.reduce((a, s) => a + s.acceptedAssertions, 0);
  return {
    cases: scores.length, expected, found, recall: expected === 0 ? null : found / expected,
    forbidden, forbiddenHits, unexpected, precision: found + unexpected === 0 ? null : found / (found + unexpected),
    cheapCaughtExpected: items.filter((i) => i.polarity === 'expected' && i.cheap === 'caught').length,
    cheapFlaggedForbidden: items.filter((i) => i.polarity === 'forbidden' && i.cheap === 'flagged').length,
    judgeRecorded: items.filter((i) => i.judge !== 'not-recorded').length,
    hallucinations, acceptedAssertions,
    hallucinationRate: hallucinations + acceptedAssertions === 0 ? null : hallucinations / (hallucinations + acceptedAssertions),
  };
}
