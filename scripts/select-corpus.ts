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
import type { CorpusCandidate, CorpusCriteria, CorpusEntry, CorpusFile, CorpusStyle } from './lib/corpus.js';
import { mulberry32 } from './lib/mutation/rng.js';

export const CORPUS_SHORTFALL = 'CORPUS_SHORTFALL';
export const SEARCH_FAILED = 'SEARCH_FAILED';
export const CANDIDATES_FILE = 'corpus/candidates.json';
export const SELECTION_FILE = 'corpus/selection.json';

export type ExclusionReason =
  | 'licence-not-osi' | 'tree-truncated' | 'files-out-of-range' | 'not-backend' | 'style-not-named'
  | 'no-package-lock' | 'archived' | 'fork' | 'core-duplicate' | 'not drawn';

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
export function exclusionReason(c: CorpusCandidate, criteria: CorpusCriteria, coreOrigins: ReadonlySet<string>): ExclusionReason | undefined {
  if (!criteria.licences.includes(c.licence.toLowerCase())) return 'licence-not-osi';
  if (c.treeTruncated === true) return 'tree-truncated';
  if (c.fileCount === undefined || c.fileCount < criteria.minFiles || c.fileCount > criteria.maxFiles) return 'files-out-of-range';
  if (c.backend !== true) return 'not-backend';
  if (c.style === undefined || !criteria.styles.includes(c.style)) return 'style-not-named';
  if (c.hasPackageLock !== true) return 'no-package-lock';
  if (c.isArchived === true) return 'archived';
  if (c.isFork === true) return 'fork';
  if (coreOrigins.has(normUrl(c.originUrl))) return 'core-duplicate';
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

const SOURCE_FILE = /^src\/.*\.ts$/;
const EXCLUDED_FILE = /\.(spec|test|d)\.ts$/;

/** C2 file count over a git tree listing (root `src/`, `.ts`, no spec / test / declaration files). */
export function countSourceFiles(paths: readonly string[]): number {
  return paths.filter((p) => SOURCE_FILE.test(p) && !EXCLUDED_FILE.test(p)).length;
}

export interface GhDeps { readonly runner: ProcessRunner; readonly env: Readonly<Record<string, string>> }

async function gh(deps: GhDeps, args: readonly string[]): Promise<string> {
  const r = await deps.runner.run('gh', args, { env: deps.env, timeoutMs: 120_000, maxOutputBytes: 64 * 1024 * 1024 });
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

export async function searchCandidates(deps: GhDeps, now: () => Date, backendPackages: readonly string[]): Promise<CandidateList> {
  const hits = new Map<string, { hit: SearchHit; queries: string[]; style: CorpusStyle }>();
  const order: readonly CorpusStyle[] = ['layered', 'clean-architecture', 'nestjs'];
  for (const q of SEARCH_QUERIES) {
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
    if (pkgText !== undefined) {
      try {
        const deps2 = (JSON.parse(pkgText) as { dependencies?: Record<string, string> }).dependencies ?? {};
        backend = backendPackages.some((p) => p in deps2);
      } catch {
        backend = false;
      }
    }
    candidates.push({
      name, originUrl: `${hit.url}.git`, licence: hit.license?.key ?? 'none', commitSha: sha,
      fileCount: countSourceFiles(paths), style, backend, hasPackageLock: paths.includes('package-lock.json'),
      isArchived: hit.isArchived === true, isFork: hit.isFork === true, treeTruncated: tree.truncated === true, queries,
    });
  }
  return { searchedAt: now().toISOString(), tool: 'gh 2.88.1 (search repos, api)', candidates };
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
