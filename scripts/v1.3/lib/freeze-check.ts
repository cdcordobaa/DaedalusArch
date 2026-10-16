/**
 * The v1.3 freeze check (Docs/v1.3/freeze-runbook.md): every precondition of the one-time hold-out run of
 * Docs/v1.3/holdout-prespec.md, checked from the repository alone, plus the byte-identity manifest of every input
 * that run depends on. It never reads a sealed directory, `.env` or any secret: the hold-out tree hash is checked by
 * `holdout-run.ts --expect-sha256` at run time, not here.
 *
 * Modes:
 *   --dry-run          report every precondition; write nothing; the engine probe is optional (skipped without
 *                      --probe-engine). Before the freeze most checks are UNMET by design.
 *   (default, strict)  the same checks; the engine probe is required (NEO4J_URI, NEO4J_PASSWORD).
 *   --write-manifest   write the manifest to --manifest (runbook step 6) instead of comparing with it.
 *   --run-tests        run the full jest suite (--maxWorkers=2) and write its summary to --tests (runbook step 5).
 * Options: --commit <sha> (the freeze commit X; default HEAD)  --answers <file>  --manifest <file>  --tests <file>
 *   --probe-engine  --json
 * Exit codes: 0 every precondition met, 1 a precondition unmet, 2 usage or environment.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../src/spec-parser/index.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { constructRuleTier } from '../../../src/construct-switches/tiers.js';
import { CONSTRUCT_ANSWERS } from '../../../src/shared/construct-switches.js';
import type { ConstructAnswers } from '../../../src/shared/construct-switches.js';
import { CONSTRUCT_QUESTION_BY_ID, CONSTRUCT_QUESTION_IDS } from '../../../src/shared/construct-switch-catalogue.js';
import { parseAnswersDocument, renderSwitchBlock, SWITCH_FILE } from './construct-answers.js';
import { defaultGit, freezeCheck, FROZEN_PATHS } from './holdout-run-main.js';
import type { GitRunner } from './holdout-run-main.js';
import { REFERENCE_STYLES } from './reference-model.js';

export const DEFAULT_ANSWERS = 'Docs/v1.3/construct-answers.json';
export const DEFAULT_MANIFEST = 'results/v1.3-freeze/manifest.json';
export const DEFAULT_TESTS = 'results/v1.3-freeze/test-suite.json';
export const DEV_RERUN_DIR = 'results/v1.3-reference/after-construct-answers';
export const HOLDOUT_RUN_DIR = 'results/v1.3-holdout/run-1';
export const PRESPEC = 'Docs/v1.3/holdout-prespec.md';
export const SEALED_HASHES = 'Docs/v1.3/sealed-hashes.md';
export const ADR_FILE = 'Docs/v1.3/adr-v13.md';
export const DECISIONS = 'Docs/v1.3/construct-decisions.md';
/** The reference engine of every reported figure, and its cross-check (freeze-runbook.md §Engine). */
export const ENGINE = { reference: 'neo4j', version: '5.26', plugin: 'apoc-core 5.26', crossCheck: 'cypher-interp' } as const;
const PLACEHOLDERS = ['<FREEZE_SHA>', '<HOLDOUT_PATH>', '<N_PER_STYLE>'] as const;
const BEGIN = '// BEGIN CONSTRUCT SWITCHES';
const END = '// END CONSTRUCT SWITCHES';

/** Directories whose every tracked file is hashed one by one in the manifest (the rest is covered by tree ids). */
export const MANIFEST_DIRS = [
  'presets', 'specs', 'src/fitness-compiler', 'src/construct-switches', 'src/scoring-engine', 'src/apg-extractor',
  'src/cypher-interp', 'scripts/v1.3',
] as const;
/** Single files hashed in the manifest. The answers file is added when present. */
export const MANIFEST_FILES = [
  'src/shared/construct-switches.ts', 'src/shared/construct-switch-catalogue.ts', 'Docs/v1.3/rule-tiers.md',
  'Docs/v1.3/style-rule-sources.md', PRESPEC, 'package.json', 'package-lock.json',
] as const;

export type CheckStatus = 'ok' | 'unmet' | 'skipped';
export interface Check {
  readonly id: string;
  readonly title: string;
  readonly status: CheckStatus;
  readonly detail: readonly string[];
}

export interface FreezeOptions {
  readonly repoRoot: string;
  readonly dryRun: boolean;
  readonly commit: string;
  readonly answers: string;
  readonly manifest: string;
  readonly tests: string;
  readonly writeManifest: boolean;
  readonly probeEngine: boolean;
  readonly json: boolean;
  readonly runTests: boolean;
}

export function parseFreezeArgs(argv: readonly string[]): FreezeOptions | string {
  const flags = new Set(['dry-run', 'write-manifest', 'probe-engine', 'json', 'run-tests']);
  const valued = new Set(['commit', 'answers', 'manifest', 'tests']);
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (!a.startsWith('--')) return `unexpected argument ${JSON.stringify(a)}`;
    const k = a.slice(2);
    if (flags.has(k)) m.set(k, 'true');
    else if (valued.has(k)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
      m.set(k, v);
      i += 1;
    } else return `unknown option ${a}`;
  }
  if (m.has('dry-run') && (m.has('write-manifest') || m.has('run-tests'))) return '--dry-run writes nothing: drop --write-manifest and --run-tests';
  return {
    repoRoot: process.cwd(), dryRun: m.has('dry-run'), commit: m.get('commit') ?? 'HEAD', answers: m.get('answers') ?? DEFAULT_ANSWERS,
    manifest: m.get('manifest') ?? DEFAULT_MANIFEST, tests: m.get('tests') ?? DEFAULT_TESTS, writeManifest: m.has('write-manifest'),
    probeEngine: m.has('probe-engine') || !m.has('dry-run'), json: m.has('json'), runTests: m.has('run-tests'),
  };
}

const sha256 = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');
const exists = (root: string, rel: string): boolean => fs.existsSync(path.resolve(root, rel));
const read = (root: string, rel: string): string => fs.readFileSync(path.resolve(root, rel), 'utf8');
const fileSha = (root: string, rel: string): string => sha256(fs.readFileSync(path.resolve(root, rel)));
const check = (id: string, title: string, problems: readonly string[], okDetail: readonly string[] = []): Check =>
  ({ id, title, status: problems.length === 0 ? 'ok' : 'unmet', detail: problems.length === 0 ? okDetail : problems });

// ── Parsers of the repository documents ───────────────────────────────────────

/** The generated block of the switch file, markers included. */
export function switchBlockOf(text: string): string | undefined {
  const i = text.indexOf(BEGIN);
  const j = text.indexOf(END);
  if (i < 0 || j < i) return undefined;
  return text.slice(i, j + END.length);
}

/** `[Answer]:` lines of construct-decisions.md in page order (Q1..Q25), the option letter or '' when empty. */
export function decisionAnswers(text: string): string[] {
  return [...text.matchAll(/^\[Answer\]:[ \t]*(.*)$/gm)].map((m) => /^(?:[Oo]ption\s*)?([A-D])(?![A-Za-z])/.exec((m[1] ?? '').trim())?.[1] ?? '');
}

/** The section of an ADR (`## <id>…` up to the next `## `), or undefined. */
export function adrSection(text: string, id: string): string | undefined {
  const i = text.search(new RegExp(`^## ${id}\\b`, 'm'));
  if (i < 0) return undefined;
  const rest = text.slice(i + 3);
  const j = rest.search(/^## /m);
  return text.slice(i, j < 0 ? undefined : i + 3 + j);
}

export function adrAccepted(section: string): boolean {
  return /\*\*Status\*\*:\s*Accepted\b/.test(section);
}

/** `| <artefact> | <64 hex> | …` rows of sealed-hashes.md, by artefact cell. */
export function sealedRows(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of text.matchAll(/^\|\s*([^|]+?)\s*\|\s*([0-9a-f]{40}|[0-9a-f]{64})\s*\|/gm)) out.set(m[1] ?? '', m[2] ?? '');
  return out;
}

/** The rows the freeze adds to sealed-hashes.md (runbook step 7). */
export const FREEZE_ROWS = {
  commit: 'v1.3 freeze commit X (tool)',
  prespec: `${PRESPEC} (frozen)`,
  manifest: `${DEFAULT_MANIFEST} (byte-identity manifest)`,
  answers: `${DEFAULT_ANSWERS} (construct answers)`,
} as const;

// ── Manifest ──────────────────────────────────────────────────────────────────

export interface FreezeManifest {
  readonly schemaVersion: 1;
  readonly note: string;
  readonly commit: string;
  readonly frozenPathTrees: Readonly<Record<string, string>>;
  readonly engine: typeof ENGINE;
  readonly node: string;
  readonly answers: { readonly file: string; readonly sha256: string | null; readonly options: Readonly<Record<string, string>>; readonly answered: number };
  readonly deferredRules: readonly string[];
  readonly compiled: Readonly<Record<string, { readonly sha256: string; readonly functions: readonly string[]; readonly disabled: readonly string[] }>>;
  readonly tiers: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly files: Readonly<Record<string, string>>;
}

function trackedFiles(git: GitRunner, dirs: readonly string[]): string[] {
  return git(['ls-files', '--', ...dirs]).split('\n').filter((l) => l !== '');
}

/**
 * Rules whose tier is still deferred at X (prespec §4). FF-DS01 is deferred unless Q15 is answered B: its option A
 * reads "keep blocking, defer the decision to hold-out evidence", and an unanswered Q15 is A.
 */
export function deferredRulesOf(answers: ConstructAnswers): string[] {
  return answers.Q15 === 'B' ? [] : ['FF-DS01'];
}

export async function buildManifest(repoRoot: string, git: GitRunner, commit: string, answersFile: string, answers: ConstructAnswers = CONSTRUCT_ANSWERS): Promise<FreezeManifest> {
  const sha = git(['rev-parse', '--verify', `${commit}^{commit}`]).trim();
  const frozenPathTrees = Object.fromEntries(FROZEN_PATHS.map((p) => [p, git(['rev-parse', `${sha}:${p}`]).trim()]));
  let answered = new Set<string>();
  let answersSha: string | null = null;
  if (exists(repoRoot, answersFile)) {
    answersSha = fileSha(repoRoot, answersFile);
    try { answered = new Set(parseAnswersDocument(JSON.parse(read(repoRoot, answersFile)) as unknown).answered); } catch { /* reported by the checks */ }
  }
  const compiled: Record<string, { sha256: string; functions: string[]; disabled: string[] }> = {};
  const tiers: Record<string, Record<string, string>> = {};
  for (const style of REFERENCE_STYLES) {
    const spec = await parseSpec({ specFilePath: path.join(repoRoot, 'presets', `${style}.yaml`) });
    if (!spec.success) throw new Error(`presets/${style}.yaml does not parse: ${spec.errors.map((e) => e.message).join('; ')}`);
    const r = compileFunctions(compilerInputFromSpec(spec.data), V13_COMPILE_OPTIONS);
    if (!r.success) throw new Error(`presets/${style}.yaml does not compile: ${r.errors.map((e) => e.message).join('; ')}`);
    const functions = r.data.symbolicQueries.map((q) => String(q.functionId));
    compiled[style] = { sha256: sha256(JSON.stringify(r.data)), functions, disabled: r.data.disabledFunctions.map((d) => String(d.id)) };
    tiers[style] = Object.fromEntries([...new Set(functions)].sort().map((id) => [id, constructRuleTier(id, style, answers).tier]));
  }
  const files: Record<string, string> = {};
  const list = [...trackedFiles(git, MANIFEST_DIRS), ...MANIFEST_FILES, ...(answersSha !== null ? [answersFile] : [])];
  for (const f of [...new Set(list)].sort()) if (exists(repoRoot, f)) files[f] = fileSha(repoRoot, f);
  return {
    schemaVersion: 1,
    note: 'Byte-identity manifest of the inputs of the v1.3 hold-out run (Docs/v1.3/freeze-runbook.md). Recomputed by scripts/v1.3/freeze-check.ts and compared byte for byte.',
    commit: sha, frozenPathTrees, engine: ENGINE, node: process.versions.node.split('.')[0] ?? '',
    answers: { file: answersFile, sha256: answersSha, options: { ...answers }, answered: answered.size },
    deferredRules: deferredRulesOf(answers), compiled, tiers, files,
  };
}

export const renderManifest = (m: FreezeManifest): string => JSON.stringify(m, null, 1) + '\n';

// ── Engine probe ──────────────────────────────────────────────────────────────

export type EngineProbe = (env: NodeJS.ProcessEnv) => Promise<{ name: string; version: string; edition: string; apoc: string | null }>;

export const neo4jProbe: EngineProbe = async (env) => {
  const neo4j = (await import('neo4j-driver')).default;
  const driver = neo4j.driver(env.NEO4J_URI ?? '', neo4j.auth.basic(env.NEO4J_USER ?? 'neo4j', env.NEO4J_PASSWORD ?? ''));
  try {
    const session = driver.session();
    try {
      const c = (await session.run('CALL dbms.components() YIELD name, versions, edition RETURN name, versions[0] AS version, edition')).records[0];
      let apoc: string | null = null;
      try { apoc = String((await session.run('RETURN apoc.version() AS v')).records[0]?.get('v') ?? ''); } catch { apoc = null; }
      return { name: String(c?.get('name') ?? ''), version: String(c?.get('version') ?? ''), edition: String(c?.get('edition') ?? ''), apoc };
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }
};

// ── The checks ────────────────────────────────────────────────────────────────

export interface FreezeDeps {
  readonly git?: GitRunner;
  readonly env?: NodeJS.ProcessEnv;
  readonly probe?: EngineProbe;
}

export interface FreezeResult {
  readonly commit: string;
  readonly checks: readonly Check[];
  readonly manifest: FreezeManifest;
}

export async function runFreezeChecks(o: FreezeOptions, deps: FreezeDeps = {}): Promise<FreezeResult> {
  const root = o.repoRoot;
  const git = deps.git ?? defaultGit(root);
  const env = deps.env ?? process.env;
  const checks: Check[] = [];
  const fc = freezeCheck(git, o.commit);
  const x = fc.sha;

  // F1 answers file: present, 25 of 25, no warnings.
  let parsed: ReturnType<typeof parseAnswersDocument> | undefined;
  {
    const p: string[] = [];
    if (!exists(root, o.answers)) p.push(`no answers file ${o.answers} (runbook step 1: commit the author's answers there)`);
    else {
      try {
        parsed = parseAnswersDocument(JSON.parse(read(root, o.answers)) as unknown);
        const missing = CONSTRUCT_QUESTION_IDS.filter((q) => !parsed?.answered.has(q));
        if (missing.length > 0) p.push(`${String(25 - missing.length)} of 25 answered; unanswered: ${missing.join(', ')}`);
        for (const w of parsed.warnings) p.push(`warning in the answers file: ${w}`);
      } catch (e) { p.push(`${o.answers}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    checks.push(check('F1', 'Construct answers file committed, 25 of 25 answered', p, parsed !== undefined ? [`${o.answers} sha256 ${fileSha(root, o.answers)}`] : []));
  }

  // F2 the switch file is exactly the rendering of the answers file.
  {
    const p: string[] = [];
    const block = switchBlockOf(read(root, SWITCH_FILE));
    if (block === undefined) p.push(`${SWITCH_FILE}: generated block markers not found`);
    else if (parsed === undefined) p.push(`${SWITCH_FILE} cannot be checked without a valid answers file (every switch reads A today, which is not an answer)`);
    else if (block !== renderSwitchBlock(parsed.answers, parsed.notes)) p.push(`${SWITCH_FILE} differs from the rendering of ${o.answers}: run apply-construct-answers.ts (runbook step 1)`);
    checks.push(check('F2', 'Answers applied: switch file equals the rendering of the answers file', p));
  }

  // F3 construct-decisions.md carries the same 25 answers.
  {
    const p: string[] = [];
    const lines = decisionAnswers(read(root, DECISIONS));
    if (lines.length !== 25) p.push(`${DECISIONS}: ${String(lines.length)} [Answer]: lines, expected 25`);
    const empty = lines.map((l, i) => (l === '' ? `Q${String(i + 1)}` : '')).filter((s) => s !== '');
    if (empty.length > 0) p.push(`${DECISIONS}: [Answer]: empty for ${empty.length === 25 ? 'all 25 questions' : empty.join(', ')}`);
    if (parsed !== undefined) {
      const diff = CONSTRUCT_QUESTION_IDS.filter((q, i) => lines[i] !== '' && lines[i] !== parsed?.answers[q]);
      if (diff.length > 0) p.push(`${DECISIONS} and ${o.answers} disagree on ${diff.join(', ')}`);
    }
    checks.push(check('F3', 'construct-decisions.md answered, and equal to the answers file', p));
  }

  // F4 ADR-V13-03 (and ADR-V13-02 when Q1 A) accepted, naming every answered question that owes an ADR entry.
  {
    const p: string[] = [];
    const text = exists(root, ADR_FILE) ? read(root, ADR_FILE) : '';
    const s3 = adrSection(text, 'ADR-V13-03');
    if (s3 === undefined) p.push(`${ADR_FILE}: no "## ADR-V13-03" section (runbook step 2)`);
    else {
      if (!adrAccepted(s3)) p.push('ADR-V13-03 is not "**Status**: Accepted"');
      if (parsed !== undefined) {
        const owed = CONSTRUCT_QUESTION_IDS.filter((q) => (CONSTRUCT_QUESTION_BY_ID.get(q)?.options[parsed?.answers[q] ?? 'A']?.adr ?? []).length > 0);
        const absent = owed.filter((q) => !new RegExp(`\\b${q}\\b`).test(s3));
        if (absent.length > 0) p.push(`ADR-V13-03 has no entry for ${absent.join(', ')}`);
      }
    }
    if (parsed?.answers.Q1 === 'A') {
      const s2 = adrSection(text, 'ADR-V13-02');
      if (s2 === undefined || !adrAccepted(s2)) p.push(`Q1 A signs ADR-V13-02: ${ADR_FILE} has no accepted "## ADR-V13-02" section (the draft is ${'Docs/v1.3/adr-v13-02-draft.md'})`);
    }
    checks.push(check('F4', 'ADR-V13-03 accepted with an entry per answer that owes one (ADR-V13-02 when Q1 A)', p));
  }

  // F5 no tier override in force still says "unsigned".
  {
    const p: string[] = [];
    const answers = CONSTRUCT_ANSWERS;
    for (const style of REFERENCE_STYLES) {
      for (const id of ['FF-P06', 'FF-S03', 'FF-S05', 'FF-DT03', 'FF-DS01', 'FF-DS03', 'FF-DT05']) {
        const reason = constructRuleTier(id, style, answers).entry?.reason ?? '';
        if (/unsigned/.test(reason)) p.push(`${style} ${id}: "${reason}" (sign the tier ADR, then update the reason in src/construct-switches/tiers.ts before X)`);
      }
    }
    checks.push(check('F5', 'No tier override in force is marked unsigned', p));
  }

  // F6 sealed hashes of the tiers and rule sources.
  const sealedText = read(root, SEALED_HASHES);
  const rows = sealedRows(sealedText);
  {
    const p: string[] = [];
    for (const f of ['Docs/v1.3/rule-tiers.md', 'Docs/v1.3/style-rule-sources.md']) {
      const want = rows.get(f);
      if (want === undefined) p.push(`${SEALED_HASHES}: no row for ${f}`);
      else if (fileSha(root, f) !== want) p.push(`${f}: sha256 ${fileSha(root, f)} is not the sealed ${want}`);
    }
    checks.push(check('F6', 'Rule tiers and rule sources at their sealed hashes', p, ['rule-tiers.md and style-rule-sources.md equal their sealed rows']));
  }

  // F7 working tree equals X in the frozen paths, nothing untracked.
  checks.push(check('F7', `Working tree equals ${o.commit} in ${FROZEN_PATHS.join(', ')}, nothing untracked`, fc.problems, [`X = ${x} (HEAD ${fc.head})`]));

  const sameCode = (other: string): string[] => {
    try {
      const d = git(['diff', '--name-only', other.trim(), x, '--', ...FROZEN_PATHS]).trim();
      return d === '' ? [] : [`the frozen paths differ between ${other.trim().slice(0, 12)} and X: ${d.split('\n').slice(0, 8).join(', ')}`];
    } catch { return [`${other.trim()} is not a commit of this repository`]; }
  };

  // F8 the development-set re-run with the answers, at code equal to X.
  {
    const p: string[] = [];
    const need = ['raw', 'report.json', 'graph/tool-graphs.json', 'scores.json', 'tool-commit.txt'];
    const missing = need.filter((f) => !exists(root, path.join(DEV_RERUN_DIR, f)));
    if (missing.length === need.length) p.push(`no development-set re-run in ${DEV_RERUN_DIR} (runbook step 3)`);
    else if (missing.length > 0) p.push(`${DEV_RERUN_DIR}: missing ${missing.join(', ')}`);
    if (exists(root, path.join(DEV_RERUN_DIR, 'tool-commit.txt'))) p.push(...sameCode(read(root, path.join(DEV_RERUN_DIR, 'tool-commit.txt'))));
    checks.push(check('F8', 'Development-set re-run and re-score with the answers, at code equal to X', p));
  }

  // F9 full test suite green at code equal to X.
  {
    const p: string[] = [];
    if (!exists(root, o.tests)) p.push(`no test-suite summary ${o.tests} (runbook step 4: freeze-check.ts --run-tests)`);
    else {
      const t = JSON.parse(read(root, o.tests)) as { commit?: string; success?: boolean; numTotalTests?: number; numFailedTests?: number; numFailedTestSuites?: number };
      if (t.success !== true || (t.numFailedTests ?? 1) !== 0 || (t.numFailedTestSuites ?? 1) !== 0) p.push(`${o.tests}: not green (${String(t.numFailedTests)} failed tests, ${String(t.numFailedTestSuites)} failed suites)`);
      if ((t.numTotalTests ?? 0) === 0) p.push(`${o.tests}: no tests ran`);
      p.push(...sameCode(t.commit ?? ''));
    }
    checks.push(check('F9', 'Full test suite green (jest --maxWorkers=2) at code equal to X', p));
  }

  // F10 byte-identity manifest: recomputed equals committed.
  const manifest = await buildManifest(root, git, x === '' ? 'HEAD' : x, o.answers);
  {
    const p: string[] = [];
    if (o.writeManifest) { /* written by the entry after the checks */ } else if (!exists(root, o.manifest)) p.push(`no manifest ${o.manifest} (runbook step 7: freeze-check.ts --write-manifest)`);
    else if (read(root, o.manifest) !== renderManifest(manifest)) {
      const committed = JSON.parse(read(root, o.manifest)) as FreezeManifest;
      const diff = Object.keys({ ...committed.files, ...manifest.files }).filter((f) => committed.files[f] !== manifest.files[f]);
      const top = (Object.keys(manifest) as (keyof FreezeManifest)[]).filter((k) => k !== 'files' && JSON.stringify(committed[k]) !== JSON.stringify(manifest[k]));
      p.push(`${o.manifest} is not byte-identical to the recomputed manifest${top.length > 0 ? `; differs in ${top.join(', ')}` : ''}${diff.length > 0 ? `; files ${diff.slice(0, 8).join(', ')}` : ''}`);
    }
    checks.push(check('F10', 'Byte-identity manifest committed and equal to the recomputed one', p, [`manifest sha256 ${sha256(renderManifest(manifest))}`]));
  }

  // F11 prespec frozen: placeholders filled, X named, status no longer draft.
  {
    const p: string[] = [];
    const text = read(root, PRESPEC);
    const left = PLACEHOLDERS.filter((ph) => text.includes(ph));
    if (left.length > 0) p.push(`${PRESPEC}: placeholders not filled: ${left.join(', ')}`);
    if (/Status: draft/i.test(text)) p.push(`${PRESPEC}: status is still "draft"`);
    if (x !== '' && left.length === 0 && !text.includes(x)) p.push(`${PRESPEC} does not name X = ${x}`);
    checks.push(check('F11', 'Hold-out prespec frozen (placeholders filled, X named)', p));
  }

  // F12 sealed-hashes.md records X and the hashes of the frozen prespec, the manifest and the answers.
  {
    const p: string[] = [];
    const want: [string, string | undefined, string][] = [
      [FREEZE_ROWS.commit, rows.get(FREEZE_ROWS.commit), x],
      [FREEZE_ROWS.prespec, rows.get(FREEZE_ROWS.prespec), fileSha(root, PRESPEC)],
      [FREEZE_ROWS.manifest, rows.get(FREEZE_ROWS.manifest), exists(root, o.manifest) ? fileSha(root, o.manifest) : '(no manifest)'],
      [FREEZE_ROWS.answers, rows.get(FREEZE_ROWS.answers), exists(root, o.answers) ? fileSha(root, o.answers) : '(no answers file)'],
    ];
    for (const [row, got, expected] of want) {
      if (got === undefined) p.push(`${SEALED_HASHES}: no row "${row}"`);
      else if (got !== expected) p.push(`${SEALED_HASHES}: "${row}" is ${got}, expected ${expected}`);
    }
    checks.push(check('F12', 'sealed-hashes.md records X, the frozen prespec, the manifest and the answers', p));
  }

  // F13 the hold-out has not been run.
  checks.push(check('F13', 'The hold-out has not been run (no results/v1.3-holdout/run-1)',
    exists(root, HOLDOUT_RUN_DIR) ? [`${HOLDOUT_RUN_DIR} exists: the hold-out is run once (prespec §2.3); this runbook no longer applies`] : []));

  // F14 the reference engine: Neo4j 5.26 with APOC.
  if (!o.probeEngine) checks.push({ id: 'F14', title: `Reference engine reachable: Neo4j ${ENGINE.version}.x with APOC`, status: 'skipped', detail: ['dry run without --probe-engine'] });
  else {
    const p: string[] = [];
    let ok: string[] = [];
    if ((env.NEO4J_URI ?? '') === '' || (env.NEO4J_PASSWORD ?? '') === '') p.push('NEO4J_URI and NEO4J_PASSWORD are not set');
    else {
      try {
        const e = await (deps.probe ?? neo4jProbe)(env);
        if (!e.version.startsWith(`${ENGINE.version}.`)) p.push(`Neo4j ${e.version} (${e.edition}); the reference engine is ${ENGINE.version}.x`);
        if (e.apoc === null || e.apoc === '') p.push('APOC is not installed');
        ok = [`${e.name} ${e.version} ${e.edition}, APOC ${String(e.apoc)}`];
      } catch (err) { p.push(`cannot reach Neo4j: ${err instanceof Error ? err.message.replace(env.NEO4J_PASSWORD ?? '\u0000', '***') : 'error'}`); }
    }
    checks.push(check('F14', `Reference engine reachable: Neo4j ${ENGINE.version}.x with APOC`, p, ok));
  }
  return { commit: x, checks, manifest };
}

export function renderChecks(r: FreezeResult, dryRun: boolean): string {
  const unmet = r.checks.filter((c) => c.status === 'unmet');
  const out = [`v1.3 freeze check${dryRun ? ' (DRY RUN: nothing written)' : ''} at X = ${r.commit || '(unresolved)'}`];
  for (const c of r.checks) {
    out.push(`[${c.status === 'ok' ? ' OK  ' : c.status === 'unmet' ? 'UNMET' : 'SKIP '}] ${c.id} ${c.title}`);
    for (const d of c.detail) out.push(`        ${d}`);
  }
  out.push(unmet.length === 0
    ? 'FREEZE PRECONDITIONS MET'
    : `FREEZE PRECONDITIONS NOT MET: ${String(unmet.length)} of ${String(r.checks.length)} unmet (${unmet.map((c) => c.id).join(', ')})`);
  return out.join('\n') + '\n';
}

export function renderManifestSummary(m: FreezeManifest): string {
  const out = ['manifest (sha256):', `  commit ${m.commit}`];
  for (const [p, t] of Object.entries(m.frozenPathTrees)) out.push(`  tree ${p} ${t}`);
  out.push(`  engine ${m.engine.reference} ${m.engine.version}.x + ${m.engine.plugin}; cross-check ${m.engine.crossCheck}; node ${m.node}`);
  out.push(`  answers ${m.answers.file} ${m.answers.sha256 ?? '(absent)'} (${String(m.answers.answered)} of 25 answered); deferred rules: ${m.deferredRules.join(', ') || 'none'}`);
  for (const [s, c] of Object.entries(m.compiled)) out.push(`  compiled ${s} ${c.sha256} (${String(c.functions.length)} functions, disabled: ${c.disabled.join(', ') || 'none'})`);
  for (const [s, t] of Object.entries(m.tiers)) out.push(`  tiers ${s} ${sha256(JSON.stringify(t))} (blocking: ${Object.entries(t).filter(([, v]) => v === 'blocking').map(([k]) => k).join(', ')})`);
  const key = ['presets/', 'specs/', 'src/fitness-compiler/v13-templates.ts', 'src/fitness-compiler/cypher-templates.ts', 'src/scoring-engine/rule-tiers.ts', 'scripts/v1.3/lib/compare.ts', 'scripts/v1.3/lib/holdout-score.ts', 'scripts/v1.3/lib/holdout-run-main.ts', 'Docs/v1.3/'];
  for (const [f, h] of Object.entries(m.files)) if (key.some((k) => f.startsWith(k))) out.push(`  file ${f} ${h}`);
  out.push(`  (${String(Object.keys(m.files).length)} files hashed in all; manifest sha256 ${sha256(renderManifest(m))})`);
  return out.join('\n') + '\n';
}

/** Runs the full jest suite and returns the summary written to --tests. */
export function runTestSuite(repoRoot: string, commit: string): Record<string, unknown> {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'v13-freeze-jest-'));
  const out = path.join(tmp, 'jest.json');
  spawnSync(process.execPath, [path.join(repoRoot, 'node_modules/jest/bin/jest.js'), '--maxWorkers=2', '--forceExit', '--json', '--outputFile', out], { cwd: repoRoot, stdio: ['ignore', 'inherit', 'inherit'] });
  if (!fs.existsSync(out)) throw new Error('jest wrote no summary');
  const j = JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, unknown>;
  fs.rmSync(tmp, { recursive: true, force: true });
  const keys = ['success', 'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'];
  const failed = ((j.testResults ?? []) as { name: string; status: string }[]).filter((t) => t.status === 'failed').map((t) => path.relative(repoRoot, t.name));
  return { commit, command: 'jest --maxWorkers=2 --forceExit', node: process.version, ...Object.fromEntries(keys.map((k) => [k, j[k]])), failedSuites: failed };
}
