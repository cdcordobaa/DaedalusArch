/**
 * Corpus selection (FR-36; ADR-017 item 1; BR-U5b-68; U5b domain-entities §8; `Docs/corpus-criteria.md`).
 *
 * - `searchCandidates` runs the §3 search procedure of `Docs/corpus-criteria.md` through `gh` (read-only GitHub API,
 *   no clone) and returns the candidate list for `corpus/candidates.json`.
 * - `selectCorpus` is pure: candidates sorted by name, checked against C1–C6 (first failing criterion = reason),
 *   one `layered` candidate drawn first when `preferLayered`, then seeded draws (`mulberry32(seed)`) up to `addMax`;
 *   fewer than `addMin` eligible → `CORPUS_SHORTFALL`. Same seed + same list → same selection.
 * - `resolveAddedEntry` turns a selected candidate into a `CorpusEntry` with the §4 decisions (install
 *   `npm-ci-ignore-scripts` with the lock sha256 at the recorded commit, tsc `project` at the lock's version).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ProcessRunner } from '../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import { canonicalize } from './lib/canonical-json.js';
import { CORPUS_FILE, CRITERIA_DOC, loadCorpus, parseCriteria, sha256Hex } from './lib/corpus.js';
import type { CandidateAttributes, CorpusCandidate, CorpusCriteria, CorpusEntry, CorpusExtension, CorpusFile, CorpusStyle } from './lib/corpus.js';
import { mulberry32 } from './lib/mutation/rng.js';

export const CORPUS_SHORTFALL = 'CORPUS_SHORTFALL';
export const SEARCH_FAILED = 'SEARCH_FAILED';
export const CANDIDATES_FILE = 'corpus/candidates.json';
export const SELECTION_FILE = 'corpus/selection.json';
/** Extension E7-x outputs (`Docs/corpus-criteria.md` §7.4 item 8; ADR-027). */
export const CANDIDATES_E7X_FILE = 'corpus/candidates-e7x.json';
export const SELECTION_E7X_FILE = 'corpus/selection-e7x.json';

export type ExclusionReason =
  | 'licence-not-osi' | 'tree-truncated' | 'files-out-of-range' | 'not-backend' | 'style-not-named'
  | 'no-package-lock' | 'archived' | 'fork' | 'core-duplicate' | 'corpus-duplicate' | 'owner-cap' | 'not drawn';

export interface Selection {
  readonly criteriaVersion: number;
  readonly seed: number;
  readonly candidatesSha256: string;
  readonly selected: readonly { readonly name: string; readonly style: CorpusStyle; readonly fileCount: number; readonly draw: number }[];
  readonly excluded: readonly { readonly name: string; readonly reason: ExclusionReason }[];
  /** `null` when a layered candidate was drawn first; otherwise why not. */
  readonly layeredNote: string | null;
}

export interface CandidateList { readonly searchedAt: string; readonly tool: string; readonly candidates: readonly CorpusCandidate[] }

const normUrl = (u: string): string => u.toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '');

/** First failing criterion C1–C6, or `undefined` when eligible. */
export function exclusionReason(
  c: CorpusCandidate, criteria: CorpusCriteria, coreOrigins: ReadonlySet<string>,
  round?: { readonly minFiles: number; readonly maxFiles: number; readonly corpusOrigins: ReadonlySet<string> },
): ExclusionReason | undefined {
  const minFiles = round?.minFiles ?? criteria.minFiles;
  const maxFiles = round?.maxFiles ?? criteria.maxFiles;
  if (!criteria.licences.includes(c.licence.toLowerCase())) return 'licence-not-osi';
  if (c.treeTruncated === true) return 'tree-truncated';
  if (c.fileCount === undefined || c.fileCount < minFiles || c.fileCount > maxFiles) return 'files-out-of-range';
  if (c.backend !== true) return 'not-backend';
  if (c.style === undefined || !criteria.styles.includes(c.style)) return 'style-not-named';
  if (c.hasPackageLock !== true) return 'no-package-lock';
  if (c.isArchived === true) return 'archived';
  if (c.isFork === true) return 'fork';
  if (coreOrigins.has(normUrl(c.originUrl))) return 'core-duplicate';
  if (round?.corpusOrigins.has(normUrl(c.originUrl)) === true) return 'corpus-duplicate';
  return undefined;
}

export type SelectOutcome = { readonly ok: true; readonly selection: Selection } | { readonly ok: false; readonly code: typeof CORPUS_SHORTFALL; readonly detail: string };

export function selectCorpus(list: CandidateList, criteria: CorpusCriteria, coreOrigins: readonly string[]): SelectOutcome {
  const core = new Set(coreOrigins.map(normUrl));
  const sorted = [...list.candidates].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const excluded: { name: string; reason: ExclusionReason }[] = [];
  const eligible: CorpusCandidate[] = [];
  for (const c of sorted) {
    const r = exclusionReason(c, criteria, core);
    if (r === undefined) eligible.push(c);
    else excluded.push({ name: c.name, reason: r });
  }
  if (eligible.length < criteria.addMin) {
    return { ok: false, code: CORPUS_SHORTFALL, detail: `${String(eligible.length)} eligible candidates < addMin ${String(criteria.addMin)}` };
  }
  const rng = mulberry32(criteria.seed);
  const drawn: CorpusCandidate[] = [];
  let layeredNote: string | null = null;
  if (criteria.preferLayered) {
    const layered = eligible.filter((c) => c.style === 'layered');
    if (layered.length > 0) drawn.push(rng.pick(layered));
    else layeredNote = 'no eligible layered candidate';
  } else {
    layeredNote = 'preferLayered is false';
  }
  const rest = eligible.filter((c) => !drawn.includes(c));
  drawn.push(...rng.pickDistinct(rest, criteria.addMax - drawn.length));
  for (const c of eligible) if (!drawn.includes(c)) excluded.push({ name: c.name, reason: 'not drawn' });
  excluded.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    ok: true,
    selection: {
      criteriaVersion: criteria.version,
      seed: criteria.seed,
      candidatesSha256: sha256Hex(canonicalize(list)),
      selected: drawn.map((c, i) => ({ name: c.name, style: c.style ?? 'nestjs', fileCount: c.fileCount ?? 0, draw: i + 1 })),
      excluded,
      layeredNote,
    },
  };
}

// --- §3 search procedure (gh, read-only) ------------------------------------------------------------------------

export interface SearchQuery { readonly id: string; readonly topics: readonly string[]; readonly style: CorpusStyle; readonly stars?: string }

/** `Docs/corpus-criteria.md` §3, in order. */
export const SEARCH_QUERIES: readonly SearchQuery[] = [
  { id: 'Q1', topics: ['nestjs', 'layered-architecture'], style: 'layered' },
  { id: 'Q2', topics: ['layered-architecture', 'express'], style: 'layered' },
  { id: 'Q3', topics: ['nestjs', 'clean-architecture'], style: 'clean-architecture' },
  { id: 'Q4', topics: ['nestjs', 'ddd'], style: 'clean-architecture' },
  { id: 'Q5', topics: ['nestjs', 'hexagonal-architecture'], style: 'clean-architecture' },
  { id: 'Q6', topics: ['nestjs'], style: 'nestjs', stars: '>=200' },
];

/** `Docs/corpus-criteria.md` §7.2 (ADR-027): Q1–Q6 unchanged, then Q7–Q10. */
export const SEARCH_QUERIES_E7X: readonly SearchQuery[] = [
  ...SEARCH_QUERIES,
  { id: 'Q7', topics: ['hexagonal-architecture'], style: 'clean-architecture' },
  { id: 'Q8', topics: ['ports-and-adapters'], style: 'clean-architecture' },
  { id: 'Q9', topics: ['clean-architecture', 'express'], style: 'clean-architecture' },
  { id: 'Q10', topics: ['clean-architecture', 'fastify'], style: 'clean-architecture' },
];

const SOURCE_FILE = /^src\/.*\.ts$/;
const EXCLUDED_FILE = /\.(spec|test|d)\.ts$/;

/** C2 file count over a git tree listing (root `src/`, `.ts`, no spec / test / declaration files). */
export function countSourceFiles(paths: readonly string[]): number {
  return paths.filter((p) => SOURCE_FILE.test(p) && !EXCLUDED_FILE.test(p)).length;
}

export interface GhDeps { readonly runner: ProcessRunner; readonly env: Readonly<Record<string, string>> }

async function gh(deps: GhDeps, args: readonly string[]): Promise<string> {
  // A paginated listing (E7-x commit history) can take many requests.
  const timeoutMs = args.includes('--paginate') ? 1_800_000 : 120_000;
  const r = await deps.runner.run('gh', args, { env: deps.env, timeoutMs, maxOutputBytes: 64 * 1024 * 1024 });
  if (!r.success) throw new Error(`${SEARCH_FAILED}: gh ${args.slice(0, 2).join(' ')}: ${r.errors.map((e) => e.message).join('; ')}`);
  if (r.data.exitCode !== 0) throw new Error(`${SEARCH_FAILED}: gh ${args.slice(0, 3).join(' ')} exit ${String(r.data.exitCode)}: ${r.data.stderr.trim().slice(0, 300)}`);
  return r.data.stdout;
}

async function ghRaw(deps: GhDeps, path: string): Promise<string | undefined> {
  const r = await deps.runner.run('gh', ['api', '-H', 'Accept: application/vnd.github.raw', path], { env: deps.env, timeoutMs: 120_000, maxOutputBytes: 64 * 1024 * 1024 });
  if (!r.success || r.data.exitCode !== 0) return undefined;
  return r.data.stdout;
}

interface SearchHit { fullName: string; url: string; license?: { key?: string } | null; isArchived?: boolean; isFork?: boolean; defaultBranch?: string }

/** E7-x search options: the extended queries, and the eligibility inputs for the attributes (§7.3). */
export interface ExtensionSearch {
  readonly criteria: CorpusCriteria;
  readonly extension: CorpusExtension;
  readonly coreOrigins: readonly string[];
  readonly corpusOrigins: readonly string[];
}

export async function searchCandidates(deps: GhDeps, now: () => Date, backendPackages: readonly string[], ext?: ExtensionSearch): Promise<CandidateList> {
  const hits = new Map<string, { hit: SearchHit; queries: string[]; style: CorpusStyle }>();
  const order: readonly CorpusStyle[] = ['layered', 'clean-architecture', 'nestjs'];
  for (const q of ext === undefined ? SEARCH_QUERIES : SEARCH_QUERIES_E7X) {
    const args = ['search', 'repos', '--language=typescript', '--archived=false', '--sort=stars', '--limit', '30',
      ...q.topics.map((t) => `--topic=${t}`), ...(q.stars !== undefined ? [`--stars=${q.stars}`] : []),
      '--json', 'fullName,url,license,isArchived,isFork,defaultBranch'];
    const list = JSON.parse(await gh(deps, args)) as SearchHit[];
    for (const hit of list) {
      const prev = hits.get(hit.fullName);
      if (prev === undefined) hits.set(hit.fullName, { hit, queries: [q.id], style: q.style });
      else {
        prev.queries.push(q.id);
        if (order.indexOf(q.style) < order.indexOf(prev.style)) prev.style = q.style;
      }
    }
  }
  const candidates: CorpusCandidate[] = [];
  for (const name of [...hits.keys()].sort()) {
    const { hit, queries, style } = hits.get(name) as { hit: SearchHit; queries: string[]; style: CorpusStyle };
    const branch = hit.defaultBranch ?? 'main';
    const sha = (await gh(deps, ['api', `repos/${name}/commits/${branch}`, '-q', '.sha'])).trim();
    const tree = JSON.parse(await gh(deps, ['api', `repos/${name}/git/trees/${sha}?recursive=1`])) as { truncated?: boolean; tree?: { path: string; type: string }[] };
    const paths = (tree.tree ?? []).filter((t) => t.type === 'blob').map((t) => t.path);
    const pkgText = paths.includes('package.json') ? await ghRaw(deps, `repos/${name}/contents/package.json?ref=${sha}`) : undefined;
    let backend = false;
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
    if (pkgText !== undefined) {
      try {
        pkg = JSON.parse(pkgText) as typeof pkg;
        backend = backendPackages.some((p) => p in (pkg.dependencies ?? {}));
      } catch {
        backend = false;
      }
    }
    const base: CorpusCandidate = {
      name, originUrl: `${hit.url}.git`, licence: hit.license?.key ?? 'none', commitSha: sha,
      fileCount: countSourceFiles(paths), style, backend, hasPackageLock: paths.includes('package-lock.json'),
      isArchived: hit.isArchived === true, isFork: hit.isFork === true, treeTruncated: tree.truncated === true, queries,
    };
    if (ext === undefined) {
      candidates.push(base);
      continue;
    }
    const withLocks: CorpusCandidate = { ...base, hasPnpmLock: paths.includes('pnpm-lock.yaml'), hasYarnLock: paths.includes('yarn.lock') };
    const reason = exclusionReason(withLocks, ext.criteria, new Set(ext.coreOrigins.map(normUrl)), {
      minFiles: ext.extension.minFiles, maxFiles: ext.extension.maxFiles, corpusOrigins: new Set(ext.corpusOrigins.map(normUrl)),
    });
    candidates.push(reason === undefined ? { ...withLocks, attributes: await candidateAttributes(deps, name, sha, paths, pkg, queries, ext.extension) } : withLocks);
  }
  return { searchedAt: now().toISOString(), tool: 'gh 2.88.1 (search repos, api)', candidates };
}

// --- E7-x attributes (§7.3) and tiered selection (§7.4; ADR-027) ------------------------------------------------

const baseName = (p: string): string => p.slice(p.lastIndexOf('/') + 1);
const TEST_FILE = /\.(spec|test)\.ts$/;

/** A first-parent walk over a commit listing (newest first), from `sha` through `parents[0]`. */
export function firstParentChain(listing: readonly { readonly s: string; readonly p: string | null; readonly m: string }[], sha: string): { s: string; m: string }[] {
  const bySha = new Map(listing.map((c) => [c.s, c]));
  const out: { s: string; m: string }[] = [];
  const seen = new Set<string>();
  let cur: string | null = sha;
  while (cur !== null && !seen.has(cur)) {
    const c = bySha.get(cur);
    if (c === undefined) break;
    seen.add(cur);
    out.push({ s: c.s, m: c.m });
    cur = c.p;
  }
  return out;
}

/** E, H, F, R (P = sum) and A for one candidate at its recorded commit, by `gh api` only. */
export async function candidateAttributes(
  deps: GhDeps, name: string, sha: string, paths: readonly string[],
  pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  queries: readonly string[], ext: CorpusExtension,
): Promise<CandidateAttributes> {
  const allDeps = { ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
  const enforcement = [
    ...paths.filter((p) => !p.includes('node_modules/') && ext.enforcementFiles.includes(baseName(p))),
    ...ext.enforcementPackages.filter((d) => d in allDeps).map((d) => `package.json:${d}`),
  ].sort();
  const readme = await ghRaw(deps, `repos/${name}/readme?ref=${sha}`);
  const readmeHexagonal = readme !== undefined && new RegExp(ext.hexagonalReadme, 'i').test(readme);
  const H = queries.some((q) => ext.hexagonalQueries.includes(q)) || readmeHexagonal ? 1 : 0;
  const listingText = await gh(deps, ['api', '--paginate', `repos/${name}/commits?sha=${sha}&per_page=100`,
    '--jq', '.[] | {s: .sha, p: (.parents[0].sha // null), m: (.commit.message | split("\n")[0])}']);
  const listing = listingText.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as { s: string; p: string | null; m: string });
  const fix = new RegExp(ext.fixMessage, 'i');
  let fixCommit: { sha: string; subject: string } | null = null;
  for (const c of firstParentChain(listing, sha)) {
    if (!fix.test(c.m)) continue;
    const files = (await gh(deps, ['api', '--paginate', `repos/${name}/commits/${c.s}`, '--jq', '.files[] | .filename, (.previous_filename // empty)']))
      .split('\n').filter((f) => f !== '');
    if (files.some((f) => f.startsWith(ext.fixPathPrefix))) {
      fixCommit = { sha: c.s, subject: c.m };
      break;
    }
  }
  const contributors = (await gh(deps, ['api', '--paginate', `repos/${name}/contributors?per_page=100&anon=1`, '--jq', 'length']))
    .split('\n').filter((l) => l.trim() !== '').reduce((a, l) => a + Number(l), 0);
  const hasTests = paths.some((p) => TEST_FILE.test(p));
  const E = enforcement.length > 0 ? 1 : 0;
  const F = fixCommit !== null ? 1 : 0;
  const R = contributors >= ext.realMinContributors && listing.length >= ext.realMinCommits && hasTests ? 1 : 0;
  const A = ext.aiFiles.filter((f) => (f.endsWith('/') ? paths.some((p) => p.startsWith(f)) : paths.includes(f)));
  return {
    E, H, F, R, P: E + H + F + R, A,
    evidence: { enforcement, readmeHexagonal, fixCommit, commits: listing.length, contributors, hasTests },
  };
}

export interface ExtensionSelection {
  readonly extensionId: string;
  readonly criteriaVersion: number;
  readonly seed: number;
  readonly addMin: number;
  readonly addMax: number;
  readonly candidatesSha256: string;
  readonly selected: readonly { readonly name: string; readonly style: CorpusStyle; readonly fileCount: number; readonly tier: number; readonly draw: number; readonly via: 'preferLayered' | 'tier' }[];
  readonly excluded: readonly { readonly name: string; readonly reason: ExclusionReason; readonly tier?: number }[];
  readonly tiers: readonly { readonly P: number; readonly eligible: number }[];
  readonly layeredNote: string | null;
}

export type ExtensionOutcome = { readonly ok: true; readonly selection: ExtensionSelection } | { readonly ok: false; readonly code: typeof CORPUS_SHORTFALL; readonly detail: string };

const ownerOf = (name: string): string => name.slice(0, name.indexOf('/')).toLowerCase();

/** `Docs/corpus-criteria.md` §7.4. Pure; same seed and same list give the same selection. */
export function selectExtension(list: CandidateList, criteria: CorpusCriteria, coreOrigins: readonly string[], corpusOrigins: readonly string[]): ExtensionOutcome {
  const ext = criteria.extension;
  if (ext === undefined) throw new Error(`${CRITERIA_DOC}: no extension block`);
  const core = new Set(coreOrigins.map(normUrl));
  const round = { minFiles: ext.minFiles, maxFiles: ext.maxFiles, corpusOrigins: new Set(corpusOrigins.map(normUrl)) };
  const sorted = [...list.candidates].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const excluded: { name: string; reason: ExclusionReason; tier?: number }[] = [];
  const eligible: CorpusCandidate[] = [];
  for (const c of sorted) {
    const r = exclusionReason(c, criteria, core, round);
    if (r !== undefined) excluded.push({ name: c.name, reason: r });
    else if (c.attributes === undefined) throw new Error(`${c.name}: eligible but has no recorded attributes (§7.3)`);
    else eligible.push(c);
  }
  if (eligible.length < ext.addMin) {
    return { ok: false, code: CORPUS_SHORTFALL, detail: `${String(eligible.length)} eligible candidates < addMin ${String(ext.addMin)}` };
  }
  const tierOf = (c: CorpusCandidate): number => c.attributes?.P ?? 0;
  const rng = mulberry32(ext.seed);
  const selected: { c: CorpusCandidate; via: 'preferLayered' | 'tier' }[] = [];
  const owners = new Map<string, number>();
  const take = (c: CorpusCandidate, via: 'preferLayered' | 'tier'): void => {
    selected.push({ c, via });
    owners.set(ownerOf(c.name), (owners.get(ownerOf(c.name)) ?? 0) + 1);
  };
  let layeredNote: string | null = null;
  if (criteria.preferLayered) {
    const layered = eligible.filter((c) => c.style === 'layered');
    if (layered.length > 0) take(rng.pick(layered), 'preferLayered');
    else layeredNote = 'no eligible layered candidate';
  } else {
    layeredNote = 'preferLayered is false';
  }
  const done = new Set(selected.map((x) => x.c));
  for (let P = 4; P >= 0; P--) {
    const tier = eligible.filter((c) => !done.has(c) && tierOf(c) === P);
    for (const c of rng.pickDistinct(tier, tier.length)) {
      if (selected.length >= ext.addMax) excluded.push({ name: c.name, reason: 'not drawn', tier: P });
      else if ((owners.get(ownerOf(c.name)) ?? 0) >= ext.ownerCap) excluded.push({ name: c.name, reason: 'owner-cap', tier: P });
      else take(c, 'tier');
    }
  }
  excluded.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    ok: true,
    selection: {
      extensionId: ext.id, criteriaVersion: criteria.version, seed: ext.seed, addMin: ext.addMin, addMax: ext.addMax,
      candidatesSha256: sha256Hex(canonicalize(list)),
      selected: selected.map((x, i) => ({ name: x.c.name, style: x.c.style ?? 'nestjs', fileCount: x.c.fileCount ?? 0, tier: tierOf(x.c), draw: i + 1, via: x.via })),
      excluded,
      tiers: [4, 3, 2, 1, 0].map((P) => ({ P, eligible: eligible.filter((c) => tierOf(c) === P).length })),
      layeredNote,
    },
  };
}

/** TypeScript version resolved in a package-lock (v2/v3 `packages`, v1 `dependencies`). */
export function lockTypescriptVersion(lockText: string): string | undefined {
  const lock = JSON.parse(lockText) as { packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> };
  return lock.packages?.['node_modules/typescript']?.version ?? lock.dependencies?.typescript?.version;
}

/** §4 decisions for a selected candidate (reads the lock file at the recorded commit through `gh`). */
export async function resolveAddedEntry(deps: GhDeps, c: CorpusCandidate): Promise<CorpusEntry> {
  if (c.commitSha === undefined) throw new Error(`${c.name}: no recorded commit`);
  const repo = c.name;
  const lock = await ghRaw(deps, `repos/${repo}/contents/package-lock.json?ref=${c.commitSha}`);
  if (lock === undefined) throw new Error(`${c.name}: package-lock.json unreadable at ${c.commitSha}`);
  const tscVersion = lockTypescriptVersion(lock);
  if (tscVersion === undefined) throw new Error(`${c.name}: no typescript in package-lock.json`);
  const id = repo.replace('/', '__');
  return {
    name: id, originUrl: c.originUrl, licence: c.licence, ...(c.fileCount !== undefined ? { fileCount: c.fileCount } : {}),
    ...(c.style !== undefined ? { style: c.style } : {}), commitSha: c.commitSha, core: false,
    specPath: `corpus/specs/${id}.yaml`, overlays: [],
    install: { policy: 'npm-ci-ignore-scripts', lockSha256: sha256Hex(lock) },
    tsc: { kind: 'project', tscPath: 'node_modules/typescript/bin/tsc', tscVersion },
  };
}

// --- CLI ----------------------------------------------------------------------------------------------------------

/**
 * E7-x (§7, ADR-027): `--extension --search [--out corpus/candidates-e7x.json]` (network);
 * `--extension [--candidates …] [--out corpus/selection-e7x.json]` selects;
 * `--extension --append-entries [--selection …]` appends the selected entries to `corpus/corpus.json` (network).
 */
async function extensionMain(argv: readonly string[], repoRoot: string, io: SelectIo, gdeps: GhDeps, now: () => Date, criteria: CorpusCriteria): Promise<number> {
  const ext = criteria.extension;
  if (ext === undefined) {
    io.err(`${CRITERIA_DOC}: no extension block\n`);
    return 1;
  }
  const corpusPath = resolve(repoRoot, arg(argv, '--corpus') ?? CORPUS_FILE);
  const loaded = loadCorpus(corpusPath, repoRoot);
  if (!loaded.ok) {
    io.err(`${loaded.errors.join('\n')}\n`);
    return 1;
  }
  const coreOrigins = loaded.corpus.entries.filter((e) => e.core).map((e) => e.originUrl);
  const corpusOrigins = loaded.corpus.entries.map((e) => e.originUrl);
  if (argv.includes('--search')) {
    const list = await searchCandidates(gdeps, now, criteria.backendPackages, { criteria, extension: ext, coreOrigins, corpusOrigins });
    writeFileSync(resolve(repoRoot, arg(argv, '--out') ?? CANDIDATES_E7X_FILE), json(list));
    io.out(`${String(list.candidates.length)} candidates, ${String(list.candidates.filter((c) => c.attributes !== undefined).length)} with attributes\n`);
    return 0;
  }
  const list = JSON.parse(readFileSync(resolve(repoRoot, arg(argv, '--candidates') ?? CANDIDATES_E7X_FILE), 'utf8')) as CandidateList;
  if (argv.includes('--append-entries')) {
    const selection = JSON.parse(readFileSync(resolve(repoRoot, arg(argv, '--selection') ?? SELECTION_E7X_FILE), 'utf8')) as ExtensionSelection;
    const only = arg(argv, '--only')?.split(',');
    const byName = new Map(list.candidates.map((c) => [c.name, c]));
    const added: CorpusEntry[] = [];
    for (const s of selection.selected) {
      if (only !== undefined && !only.includes(s.name)) continue;
      const c = byName.get(s.name);
      if (c === undefined) throw new Error(`${s.name}: not in the candidate list`);
      added.push(await resolveAddedEntry(gdeps, c));
    }
    const names = new Set(loaded.corpus.entries.map((e) => e.name));
    const next: CorpusFile = { version: loaded.corpus.version, entries: [...loaded.corpus.entries, ...added.filter((e) => !names.has(e.name))] };
    writeFileSync(corpusPath, json(next));
    io.out(`${String(added.length)} entries appended\n`);
    return 0;
  }
  const r = selectExtension(list, criteria, coreOrigins, corpusOrigins);
  if (!r.ok) {
    io.err(`${r.code}: ${r.detail}\n`);
    return 1;
  }
  writeFileSync(resolve(repoRoot, arg(argv, '--out') ?? SELECTION_E7X_FILE), json(r.selection));
  io.out(`${r.selection.selected.map((s) => `${s.name} (${s.style}, ${String(s.fileCount)} files, P ${String(s.tier)}, ${s.via})`).join('\n')}\n`);
  return 0;
}

export interface SelectIo { readonly out: (t: string) => void; readonly err: (t: string) => void }

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/**
 * `--search [--out corpus/candidates.json]` runs §3 (network);
 * default: `[--candidates …] [--out corpus/selection.json]` selects;
 * `--append-entries` resolves the selection's entries (network) and appends them to `corpus/corpus.json`.
 */
export async function main(argv: readonly string[], repoRoot: string, io: SelectIo, deps?: GhDeps, now: () => Date = () => new Date()): Promise<number> {
  try {
    const criteria = parseCriteria(readFileSync(join(repoRoot, CRITERIA_DOC), 'utf8'));
    if (argv.includes('--self-test')) {
      // BR-U5b-73: built-in known-bad input, an empty candidate list, must be refused with CORPUS_SHORTFALL.
      const r = selectCorpus({ searchedAt: '1970-01-01T00:00:00.000Z', tool: 'self-test', candidates: [] }, criteria, []);
      io.err(r.ok ? 'self-test: an empty candidate list was accepted\n' : `self-test: ${r.code}: ${r.detail}\n`);
      return 1;
    }
    const gdeps: GhDeps = deps ?? { runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME', 'GH_TOKEN', 'GH_HOST', 'XDG_CONFIG_HOME']) };
    if (argv.includes('--extension')) return await extensionMain(argv, repoRoot, io, gdeps, now, criteria);
    if (argv.includes('--search')) {
      const list = await searchCandidates(gdeps, now, criteria.backendPackages);
      writeFileSync(resolve(repoRoot, arg(argv, '--out') ?? CANDIDATES_FILE), json(list));
      io.out(`${String(list.candidates.length)} candidates\n`);
      return 0;
    }
    const corpusPath = resolve(repoRoot, arg(argv, '--corpus') ?? CORPUS_FILE);
    const loaded = loadCorpus(corpusPath, repoRoot);
    if (!loaded.ok) {
      io.err(`${loaded.errors.join('\n')}\n`);
      return 1;
    }
    const list = JSON.parse(readFileSync(resolve(repoRoot, arg(argv, '--candidates') ?? CANDIDATES_FILE), 'utf8')) as CandidateList;
    if (argv.includes('--append-entries')) {
      const selection = JSON.parse(readFileSync(resolve(repoRoot, arg(argv, '--selection') ?? SELECTION_FILE), 'utf8')) as Selection;
      const byName = new Map(list.candidates.map((c) => [c.name, c]));
      const added: CorpusEntry[] = [];
      for (const s of selection.selected) {
        const c = byName.get(s.name);
        if (c === undefined) throw new Error(`${s.name}: not in the candidate list`);
        added.push(await resolveAddedEntry(gdeps, c));
      }
      const names = new Set(loaded.corpus.entries.map((e) => e.name));
      const next: CorpusFile = { version: loaded.corpus.version, entries: [...loaded.corpus.entries, ...added.filter((e) => !names.has(e.name))] };
      writeFileSync(corpusPath, json(next));
      io.out(`${String(added.length)} entries appended\n`);
      return 0;
    }
    const r = selectCorpus(list, criteria, loaded.corpus.entries.filter((e) => e.core).map((e) => e.originUrl));
    if (!r.ok) {
      io.err(`${r.code}: ${r.detail}\n`);
      return 1;
    }
    writeFileSync(resolve(repoRoot, arg(argv, '--out') ?? SELECTION_FILE), json(r.selection));
    io.out(`${r.selection.selected.map((s) => `${s.name} (${s.style}, ${String(s.fileCount)} files)`).join('\n')}\n`);
    return 0;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
}
