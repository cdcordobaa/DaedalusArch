/**
 * BF-01 brownfield norm-derivation pilot driver (ops/notes/bf-01-brownfield-norm-derivation.md §7).
 *
 * 2 repos (luizomf-clean-api, zeldaplay-api) x 2 arms (G: Read/Grep/Glob + the read-only fact server
 * `bf-01-facts-server.ts`; R: Read/Grep/Glob only) x 3 runs = 12 Claude Code headless sessions, one at a time,
 * model pinned to claude-sonnet-5-5. HARD CAP: 14 spawns of the claude CLI in total (the pilot plus at most one
 * retry per arm, retries only for infrastructure, timeout or unreadable-envelope failures). Every spawn is written to
 * the ledger BEFORE it starts, so a crash cannot hide a session.
 *
 *   npx tsx scripts/v1.3/bf-01-run.ts --dry-run   zero calls: plan, argv invariants, isolation listing check, CLI
 *                                                 version, fact-server smoke on both clones, a stub session per arm
 *   npx tsx scripts/v1.3/bf-01-run.ts --run       the live pilot (resumes: completed sessions are skipped)
 *
 * Reused, unchanged: the confinement-argv checks (`withMcpServer`, `checkArmArgs`, `mcpToolRules`), the allow-listed
 * child env and the judge isolation route (`isolatedClaudeEnv`, `checkIsolationBeforeSpawn`: the config dir is listed
 * by name only, ADR-018), `parseEnvelope`, `turnStatus`, `turnUsage`, `judgeModelUsage`, `NodeProcessRunner`, the
 * stream-json transcript reader `analyseTranscript`. Not reused: `runWithRetries` (it may spawn again on its own; the
 * hard cap needs every spawn counted here) and `buildArmCall` (Write/Edit, acceptEdits, the Study 2 tool list).
 *
 * Outputs: results/v1.3-brownfield/llm-pilot/{plan.json, ledger.json, sessions/<sid>/...}. Absolute paths are
 * rewritten (<repo>, <harness>, ~) before anything is saved. The model has no Write tool: the driver extracts the two
 * fenced blocks of the final message and composes derived.yaml from the preset.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { JUDGE_CONFIG_DIR_DEFAULT } from '../../src/llm-critic/frozen.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { checkArmArgs, mcpToolRules, withMcpServer } from '../lib/generators/arms.js';
import { parseEnvelope } from '../lib/generators/envelope.js';
import { judgeModelUsage } from '../lib/generators/model-usage.js';
import { turnStatus, turnUsage } from '../lib/loop/agents.js';
import { checkIsolationBeforeSpawn, isolatedClaudeEnv, parseCliVersion } from '../lib/loop/isolation.js';
import { analyseTranscript } from './lib/mcp-smoke.js';
import { FACTS_SERVER, FACT_TOOLS, buildFactsGraph, readOnlyQuery } from './lib/bf-01-facts.js';
import { checkCitation } from './bf-01-verify-evidence.js';
import { LAYER_KINDS } from '../../src/shared/types/enums.js';
import { AGY_HOME_DEFAULT, AgyCliProvider, checkAgyIsolation, expandHome } from '../../src/llm-critic/agy-cli-provider.js';
import type { LLMProvider, LLMResponse } from '../../src/shared/interfaces/llm-provider.js';

/** v1 = the 2026-10-19 pilot as run; v2 = the redesign after it (ops/notes/bf-01 "v2 after pilot"). Default v2. */
export const DESIGN: 'v1' | 'v2' = process.argv.includes('--design') && process.argv[process.argv.indexOf('--design') + 1] === 'v1' ? 'v1' : 'v2';
export const MODEL = 'claude-sonnet-5-5';
/** The cross-vendor arm X (v2): Gemini 4 Argon (High) through the repo's agy labeller route, one shot, no tools. */
export const GEMINI_MODEL = 'gemini-4-argon-high';
export const modelFor = (arm: Arm): string => (arm === 'X' ? GEMINI_MODEL : MODEL);
/** Hard caps on spawns, counted in the ledger before each start. v2: 18 sessions + 1 retry per arm. */
export const HARD_CAP = DESIGN === 'v1' ? 14 : 20; // v2: N = 18 planned + 2 (author's rule: N + 2, probes and retries included)
export const RETRY_PER_ARM = 1;
export const TIMEOUT_MS = 900_000;
export const TURN_CAP = 40;
export const TOKEN_CAP = 600_000;
export const REPOS = ['luizomf-clean-api', 'zeldaplay-api'] as const;
export type Arm = 'G' | 'R' | 'X';
const ARM_ARG = process.argv.includes('--arms') ? (process.argv[process.argv.indexOf('--arms') + 1] ?? '').split(',') : undefined;
export const ARMS: readonly Arm[] = (DESIGN === 'v1' ? (['G', 'R'] as Arm[]) : (['G', 'R', 'X'] as Arm[])).filter((a) => ARM_ARG === undefined || ARM_ARG.includes(a));
export const ALL_ARMS: readonly Arm[] = DESIGN === 'v1' ? ['G', 'R'] : ['G', 'R', 'X'];
export const RUNS = 3;

const REPO_ROOT = path.resolve('.');
const REPO_REAL = fs.realpathSync(REPO_ROOT);
const CLONES = path.join(REPO_ROOT, 'tmp', 'brownfield-clones');
const OUT = path.join(REPO_ROOT, 'results', 'v1.3-brownfield', DESIGN === 'v1' ? 'llm-pilot' : 'llm-pilot-v2');
const HARNESS = path.join(os.tmpdir(), 'bf01-harness');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SERVER = path.join(REPO_ROOT, 'scripts', 'v1.3', 'bf-01-facts-server.ts');
/** Sessions run from a copy of each clone outside the repository, so no ancestor CLAUDE.md (DaedalusArch's) loads:
 *  --safe-mode would block that but also disables every --mcp-config server (2026-10-19 probe; `claude --safe-mode mcp list`). */
const RUN_CLONES = path.join(HARNESS, 'clones');
export function runClone(repo: string): string {
  const dst = path.join(RUN_CLONES, repo);
  if (!fs.existsSync(dst)) { fs.mkdirSync(RUN_CLONES, { recursive: true }); fs.cpSync(path.join(CLONES, repo), dst, { recursive: true }); }
  for (let d = path.dirname(dst); d !== path.dirname(d); d = path.dirname(d)) if (fs.existsSync(path.join(d, 'CLAUDE.md')) || fs.existsSync(path.join(d, '.claude', 'CLAUDE.md'))) throw new Error(`ancestor CLAUDE.md at ${d}`);
  return dst;
}
const RETRYABLE = new Set(['infrastructure', 'timeout', 'envelope-unreadable']);

interface Entry { id: string; sha: string; root: string; style: string }
const SELECTION = (JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'results/v1.3-external/selection.json'), 'utf8')) as { entries: Entry[] }).entries;
const entry = (id: string): Entry => { const e = SELECTION.find((x) => x.id === id); if (e === undefined) throw new Error(`no selection entry ${id}`); return e; };
const PRESET_FILE: Record<string, string> = { 'clean-architecture': 'presets/clean-architecture.yaml', nestjs: 'presets/nestjs.yaml', layered: 'presets/layered.yaml', hexagonal: 'presets/hexagonal.yaml', ddd: 'presets/ddd.yaml' };

export interface PlannedSession { readonly sid: string; readonly repo: string; readonly arm: Arm; readonly run: number; readonly order: number }

/** Run-major, then repo, then arm: each run block holds both arms on both repos (no arm runs all its sessions first). */
export function plan(): PlannedSession[] {
  const out: PlannedSession[] = [];
  for (let run = 1; run <= RUNS; run++) for (const repo of REPOS) for (const arm of ALL_ARMS) out.push({ sid: `bf01-${repo}-${arm}-r${String(run)}`, repo, arm, run, order: out.length + 1 });
  return out;
}

// ── Scrubbing ────────────────────────────────────────────────────────────────────────────────────────────────────

export function scrub(s: string): string {
  const pairs: [string, string][] = [[HARNESS, '<harness>'], [fs.existsSync(HARNESS) ? fs.realpathSync(HARNESS) : HARNESS, '<harness>'], [REPO_REAL, '<repo>'], [REPO_ROOT, '<repo>'], [os.homedir(), '~']];
  let t = s;
  for (const [a, b] of pairs.sort((x, y) => y[0].length - x[0].length)) t = t.split(a).join(b);
  return t.replace(/\/Volumes\/[^\s"'`]*/g, '<abs>').replace(/\/Users\/[^\s"'`/]+/g, '~');
}

// ── The frame ────────────────────────────────────────────────────────────────────────────────────────────────────

const ARM_TOOLS: Record<'G' | 'R', string> = {
  G: '- Read, Grep and Glob on the files of this repository, and the read-only `daedalus-facts` MCP tools: facts from the project\'s parser graph (folder import matrix with package imports, fan-in, class-name and file-name suffixes, implements/extends by folder, and read-only Cypher through `query_graph`). The graph carries no layers and no rules.',
  R: '- Read, Grep and Glob on the files of this repository. You have no graph tools, so you cannot give stat citations.',
};

export function frame(repo: string, arm: Arm): string {
  if (DESIGN === 'v2') return frameV2(repo, arm);
  if (arm === 'X') throw new Error('arm X exists in v2 only');
  const e = entry(repo);
  const preset = fs.readFileSync(path.join(REPO_ROOT, PRESET_FILE[e.style] ?? ''), 'utf8');
  const root = e.root === '.' ? 'the working directory itself' : `\`${e.root}\``;
  return `You are deriving the architecture spec of an existing TypeScript repository from its code and its docs.

Repository: the current working directory, a clone pinned at commit ${e.sha}. Analysis root: ${root}. Every glob in the spec, and every pattern citation, is relative to the analysis root.
Declared style: \`${e.style}\` (the repository states this style). Keep it.

The spec format is the preset at the end of this message. A spec for a repository copies the preset's fitness_functions and authors the \`architecture:\` block: the layers in the preset's order semantics, each layer's \`directories\` and \`file_patterns\` globs (relative to the analysis root), \`roles\`, \`decorators\` and optional \`kind\`. It may also change \`default_exclude_paths\` and make fitness-function changes (enable or disable a function, or change a parameter such as \`forbidden_imports\`) when the repository gives evidence for them.

Your task: propose the norm set this repository's authors intend: the layers, which folders and files belong to each, the layer order, the enabled functions and their parameters, and the excludes, as a careful architect writing this spec for the team would. The intended norm is not necessarily what most files do today. Every unit you propose must cite evidence that you did not produce yourself (the citation types below). A unit without a citation that passes its check is dropped.

Tools:
${ARM_TOOLS[arm]}
- Stay inside the working directory. Do not run anything. You cannot write files: your final message is the output.

Citation types. Each is checked mechanically at the pinned commit, and a citation that fails its check does not count:
- doc: {"type": "doc", "file": "<path relative to the working directory>", "line": <1-based line number>, "quote": "<verbatim text from that one line>"}
- pattern: {"type": "pattern", "glob": "<glob relative to the analysis root>", "count": <number of git-tracked files under the analysis root that the glob matches (picomatch, dot files included)>}
- stat: {"type": "stat", "query": "<read-only Cypher that returns one row with columns numerator and denominator>", "numerator": <n>, "denominator": <d>}. It is re-run on the same parser graph and must give the same two numbers.

Units, one evidence entry each:
- "layer:<name>" for every layer in your architecture block (its membership: directories and file_patterns);
- "order" for the layer order;
- "ff:<function id>" for every fitness-function change you make;
- "exclude:<glob>" for every path you add to or remove from the preset's default_exclude_paths;
- "ddd" for the ddd declarations, only if the style is ddd.

Final answer: exactly two fenced code blocks and nothing after them.
1. A \`\`\`yaml block with the top-level keys \`architecture\` (the full block, style included), \`default_exclude_paths\` (the full list; leave the key out to keep the preset's list) and \`fitness_overrides\` (optional: a list of {id, enabled, reason, params}, where params maps parameter names to values).
2. A \`\`\`json block: {"units": [{"id": "layer:domain", "claim": "<one sentence>", "origin": "proposed", "citations": [ ... ]}, ...]}.

Keep to at most 35 tool calls.

The preset (\`${PRESET_FILE[e.style] ?? ''}\`):

\`\`\`yaml
${preset.trimEnd()}
\`\`\`
`;
}

// ── The v2 frame (after the pilot) ───────────────────────────────────────────────────────────────────────────────

/** Docs pre-supplied to every v2 arm: tracked and present READMEs, CONTRIBUTING, ADRs and docs/ markdown. */
export const DOC_RE = /(^|\/)(readme|contributing)[^/]*\.md$|(^|\/)docs?\/.*\.md$|(^|\/)[^/]*adr[^/]*\/.*\.md$|(^|\/)architecture[^/]*\.md$/i;
const DOC_FILE_CAP = 20_000;
const DOC_TOTAL_CAP = 60_000;
export function docsFor(repo: string): { file: string; text: string; truncated: boolean }[] {
  const clone = path.join(CLONES, repo);
  const files = execFileSync('git', ['-C', clone, 'ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => DOC_RE.test(f) && !/ISSUE_TEMPLATE|PULL_REQUEST/i.test(f) && fs.existsSync(path.join(clone, f))).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  const out: { file: string; text: string; truncated: boolean }[] = [];
  let total = 0;
  for (const f of files) {
    const raw = fs.readFileSync(path.join(clone, f), 'utf8');
    const numbered = raw.split(/\r?\n/).map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join('\n');
    const room = Math.max(0, Math.min(DOC_FILE_CAP, DOC_TOTAL_CAP - total));
    if (room === 0) break;
    out.push({ file: f, text: numbered.slice(0, room), truncated: numbered.length > room });
    total += Math.min(room, numbered.length);
  }
  return out;
}
export function trackedUnderRoot(repo: string): string[] {
  const e = entry(repo);
  return execFileSync('git', ['-C', path.join(CLONES, repo, e.root), 'ls-files', '--', '.'], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

const V2_TOOLS: Record<Arm, string> = {
  R: 'You have Read, Grep and Glob on the files of this repository (the working directory). You have no graph tools.',
  G: 'You have Read, Grep and Glob on the files of this repository (the working directory), and the read-only `daedalus-facts` MCP tools over the project\'s parser graph: folder_dependency_matrix (imports between folders, plus package imports), fan_in, class_suffix_stats, implements_by_folder, and query_graph (read-only Cypher). The graph carries no layers and no rules.',
  X: 'You have no tools. Work from the docs and the file list in this message; you cannot open other files.',
};

const V2_GRAPH_STEP = `3. Check and quantify with the graph, before you finalise any unit. The graph tools do not replace steps 1 and 2; they check them.
   - For every layer: how many files it holds, and how its files import each other layer (folder_dependency_matrix, or query_graph).
   - For the order: the number of import edges that follow it and the number that violate it (an inner layer importing an outer one).
   - For any fitness-function or exclude change: how many files or edges it would flag.
   Cite each count as a stat citation. Every layer unit and the "order" unit must carry at least one stat citation in addition to its doc or pattern citations. Where the code disagrees with the docs, keep the declared intent in the spec and state the number of disagreeing edges in the claim.
   Example stat query (one row, columns numerator and denominator): MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.filePath STARTS WITH 'src/x/' AND b.filePath STARTS WITH 'src/y/' RETURN count(*) AS numerator, count(DISTINCT a) AS denominator`;

export function frameV2(repo: string, arm: Arm): string {
  const e = entry(repo);
  const preset = fs.readFileSync(path.join(REPO_ROOT, PRESET_FILE[e.style] ?? ''), 'utf8');
  const root = e.root === '.' ? 'the repository root itself' : `\`${e.root}\``;
  const docs = docsFor(repo);
  const tree = trackedUnderRoot(repo);
  const docBlock = docs.length === 0 ? '(no docs are tracked)' : docs.map((d) => `--- ${d.file}${d.truncated ? ' (truncated)' : ''} ---\n${d.text}`).join('\n\n');
  return `You are deriving the architecture spec of an existing TypeScript repository from its docs and its code.

Repository: a clone pinned at commit ${e.sha}${arm === 'X' ? '' : ' (your working directory)'}. Analysis root: ${root}. Every glob in the spec, and every pattern citation, is relative to the analysis root. Doc citation paths are relative to the repository root.
Declared style: \`${e.style}\` (the repository states this style). Keep it.

The spec format is the preset at the end of this message. A spec copies the preset's fitness_functions and authors the \`architecture:\` block: the layers in the preset's order semantics, each layer's \`directories\` and \`file_patterns\` globs (relative to the analysis root), \`roles\`, \`decorators\` and optional \`kind\`. It may also change \`default_exclude_paths\` and make fitness-function changes (enable or disable a function, or change a parameter such as \`forbidden_imports\`) when the repository gives evidence for them. The spec is validated against its schema: \`kind\`, when given, must be one of ${LAYER_KINDS.join(', ')}; a folder that belongs to no layer (for example a cross-cutting helper folder) is left out of every layer, not given a layer of its own kind.

Your task: propose the norm set this repository's authors intend (the layers, which folders and files belong to each, the layer order, the enabled functions and their parameters, the excludes), as a careful architect writing this spec for the team would. The intended norm is not necessarily what most files do today.

Tools: ${V2_TOOLS[arm]}${arm === 'X' ? '' : ' Stay inside the working directory. Do not run anything. You cannot write files: your final message is the output.'}

Reading procedure, in this order:
1. Read the repository docs supplied below in full. They state the declared intent. Cite them (doc citations) for every unit they bear on.
2. Inspect the structure: the tracked file list below${arm === 'X' ? '' : ', and representative files of each folder you assign (Read, Grep, Glob)'}. Cite folder membership with pattern citations.
${arm === 'G' ? V2_GRAPH_STEP : `3. (No graph step: you have no graph tools.)`}

Evidence is required for every unit, and it is checked as soon as you answer: a session whose answer has no citation that passes its check, or no passing doc citation while docs are supplied${arm === 'G' ? ', or no passing stat citation' : ''}, fails.

Citation types, each checked mechanically at the pinned commit:
- doc: {"type": "doc", "file": "<path relative to the repository root>", "line": <1-based line number, as numbered below>, "quote": "<verbatim text from that one line>"}
- pattern: {"type": "pattern", "glob": "<glob relative to the analysis root>", "count": <number of tracked files under the analysis root it matches (picomatch, dot files included); the file list below is that set>}
${arm === 'G' ? '- stat: {"type": "stat", "query": "<read-only Cypher returning one row with columns numerator and denominator>", "numerator": <n>, "denominator": <d>}, re-run on the same parser graph.\n' : ''}
Units, one evidence entry each: "layer:<name>" for every layer; "order" for the layer order; "ff:<function id>" for every fitness-function change; "exclude:<glob>" for every path added to or removed from the preset's default_exclude_paths; "ddd" only if the style is ddd.

Final answer: ${arm === 'X' ? 'a JSON object with two fields: "spec_yaml" (a string holding the YAML described next) and "evidence" (the evidence object described next).' : 'exactly two fenced code blocks and nothing after them.'}
1. ${arm === 'X' ? 'spec_yaml' : 'A ```yaml block'}: top-level keys \`architecture\` (the full block, style included), \`default_exclude_paths\` (the full list; leave it out to keep the preset's) and \`fitness_overrides\` (optional list of {id, enabled, reason, params}).
2. ${arm === 'X' ? 'evidence' : 'A ```json block'}: {"units": [{"id": "layer:domain", "claim": "<one sentence>", "origin": "proposed", "citations": [ ... ]}, ...]}.
${arm === 'X' ? '' : '\nKeep to at most 35 tool calls.\n'}
=== Repository docs (line-numbered) ===
${docBlock}

=== Tracked files under the analysis root (${String(tree.length)}) ===
${tree.join('\n')}

=== The preset (\`${PRESET_FILE[e.style] ?? ''}\`) ===
\`\`\`yaml
${preset.trimEnd()}
\`\`\`
`;
}

// ── Argv ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function sessionPaths(sid: string): { dir: string; home: string; mcp: string; callLog: string } {
  const dir = path.join(HARNESS, 'runs', sid);
  return { dir, home: path.join(dir, 'home'), mcp: path.join(dir, 'mcp-G.json'), callLog: path.join(dir, 'facts-calls.jsonl') };
}

export function argvFor(s: PlannedSession, prompt: string): { args: readonly string[]; mcpConfig: unknown } {
  const base = ['-p', prompt, '--model', MODEL, '--output-format', 'stream-json', '--verbose', '--restricted', '--disable-slash-commands',
    '--tools', 'Read,Grep,Glob', '--disallowedTools', 'Write', 'Edit', 'Bash', 'WebFetch', 'WebSearch',
    '--permission-prompts', 'none', '--no-session-persistence', '--strict-mcp-config'];
  if (s.arm === 'X') return { args: ['<agy one-shot via AgyCliProvider: --output-format stream-json --model', GEMINI_MODEL, '--json-schema <schema> --sandbox --disable-slash-commands --print-timeout 240s; prompt on stdin; fresh empty cwd>'], mcpConfig: null };
  if (s.arm === 'R') {
    const ok = checkArmArgs(base, null);
    if (!ok.success) throw new Error(`argv check: ${JSON.stringify(ok.errors)}`);
    return { args: base, mcpConfig: null };
  }
  const p = sessionPaths(s.sid);
  const e = entry(s.repo);
  const args = withMcpServer(base, p.mcp, mcpToolRules(FACTS_SERVER, FACT_TOOLS), []);
  const ok = checkArmArgs(args, FACTS_SERVER);
  if (!ok.success) throw new Error(`argv check: ${JSON.stringify(ok.errors)}`);
  const mcpConfig = { mcpServers: { [FACTS_SERVER]: { type: 'stdio', command: TSX, args: [SERVER, '--project', path.join(runClone(s.repo), e.root), '--call-log', p.callLog], env: {} } } };
  return { args, mcpConfig };
}

// ── Output extraction and composition ────────────────────────────────────────────────────────────────────────────

export function lastBlock(text: string, lang: string): string | null {
  const re = new RegExp('```' + lang + '[^\\n]*\\n([\\s\\S]*?)```', 'g');
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = re.exec(text)) !== null) last = m[1] ?? null;
  return last;
}

interface Override { id: string; enabled?: boolean; reason?: string; params?: Record<string, unknown> }

/** The preset with `architecture`, `default_exclude_paths` and the overrides applied (no other key is touched). */
export function compose(style: string, derived: { architecture?: unknown; default_exclude_paths?: unknown; fitness_overrides?: unknown }, header: string): string {
  const doc = YAML.parseDocument(fs.readFileSync(path.join(REPO_ROOT, PRESET_FILE[style] ?? ''), 'utf8'));
  if (derived.architecture === undefined) throw new Error('no architecture key');
  doc.set('architecture', doc.createNode(derived.architecture));
  if (Array.isArray(derived.default_exclude_paths)) doc.set('default_exclude_paths', doc.createNode(derived.default_exclude_paths));
  const ffs = doc.get('fitness_functions') as YAML.YAMLSeq<YAML.YAMLMap> | undefined;
  for (const o of (Array.isArray(derived.fitness_overrides) ? derived.fitness_overrides : []) as Override[]) {
    const item = ffs?.items.find((it) => it.get('id') === o.id);
    if (item === undefined) continue;
    if (typeof o.enabled === 'boolean') item.set('enabled', o.enabled);
    if (typeof o.reason === 'string') item.set('reason', o.reason);
    for (const [k, v] of Object.entries(o.params ?? {})) if (!['id', 'name', 'dimension', 'route'].includes(k)) item.set(k, doc.createNode(v));
  }
  doc.commentBefore = header;
  return doc.toString({ lineWidth: 0 });
}

// ── One session ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Per-engine caps inside HARD_CAP: v2 = Claude 12 + 2 retries, Gemini 6 + 1 retry. */
export const ENGINE_CAP: Record<'claude' | 'agy', number> = DESIGN === 'v1' ? { claude: 14, agy: 0 } : { claude: 14, agy: 7 };
interface Ledger { hardCap: number; spawns: { n: number; sid: string; engine?: string; attemptOf: string; startedAt: string; endedAt?: string; status?: string }[] }
const LEDGER = path.join(OUT, 'ledger.json');
function readLedger(file = LEDGER): Ledger { return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Ledger) : { hardCap: HARD_CAP, spawns: [] }; }
function writeLedger(l: Ledger, file = LEDGER): void { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(l, null, 1)}\n`); }

interface SessionMeta {
  sid: string; repo: string; arm: Arm; run: number; attempt: number; model: string; cliVersion: string | null;
  status: string; modelValid: boolean; usage: unknown; processedTokens: number | null; wallMs: number; exitCode: number | null; timedOut: boolean | null;
  capFlags: string[]; mcp: unknown; toolCalls: Record<string, number>; confinementViolations: string[];
  output: { yaml: boolean; json: boolean; composed: boolean; specValid: boolean | null; specErrors: string[]; styleKept: boolean | null };
  evidenceGate: { pass: boolean; reasons: string[]; verified: Record<string, number> } | null;
  promptSha256: string; argv: readonly string[]; configListingSha256: string;
}

function initMcp(stdout: string): unknown {
  for (const line of stdout.split(/\r?\n/)) {
    try {
      const ev = JSON.parse(line) as { type?: string; subtype?: string; mcp_servers?: unknown; tools?: unknown; model?: string };
      if (ev.type === 'system' && ev.subtype === 'init') return { mcp_servers: ev.mcp_servers ?? null, tools: ev.tools ?? null, model: ev.model ?? null };
    } catch { /* not JSON */ }
  }
  return null;
}

function confinement(calls: readonly { name: string; input: Readonly<Record<string, unknown>> }[], cwd: string): string[] {
  const bad: string[] = [];
  const real = fs.realpathSync(cwd);
  for (const c of calls) {
    for (const k of ['file_path', 'path', 'notebook_path']) {
      const v = c.input[k];
      if (typeof v !== 'string' || v === '') continue;
      const abs = path.isAbsolute(v) ? path.resolve(v) : path.resolve(cwd, v);
      const inside = (d: string): boolean => abs === d || abs.startsWith(d + path.sep);
      if (!inside(cwd) && !inside(real)) bad.push(`${c.name}:${k}=${scrub(v)}`);
    }
    const pat = c.input.pattern;
    if (c.name === 'Glob' && typeof pat === 'string' && (path.isAbsolute(pat) || pat.includes('..'))) {
      const abs = path.resolve(cwd, pat);
      if (!abs.startsWith(cwd) && !abs.startsWith(real)) bad.push(`Glob:pattern=${scrub(pat)}`);
    }
  }
  return bad;
}

export async function runSession(s: PlannedSession, runner: ProcessRunner, outRoot: string, attempt: number, ledgerFile: string, cliVersion: string | null): Promise<SessionMeta> {
  const e = entry(s.repo);
  const cwd = runClone(s.repo);
  const prompt = frame(s.repo, s.arm);
  const p = sessionPaths(s.sid);
  fs.rmSync(p.dir, { recursive: true, force: true });
  fs.mkdirSync(p.dir, { recursive: true });
  const { args, mcpConfig } = argvFor(s, prompt);
  if (mcpConfig !== null) fs.writeFileSync(p.mcp, `${JSON.stringify(mcpConfig, null, 2)}\n`, { mode: 0o600 });
  const iso = { configDir: JUDGE_CONFIG_DIR_DEFAULT.replace(/^~/, os.homedir()) };
  const okIso = checkIsolationBeforeSpawn(p.home, iso);
  if (!okIso.success) throw new Error(`isolation: ${JSON.stringify(okIso.errors.map((x) => x.code))}`);
  // Judge route, not the loop's empty HOME: the CLI keeps the login in the macOS Keychain, which an empty HOME hides
  // ("Not logged in", 2026-10-19). Allow-listed env + CLAUDE_CONFIG_DIR + auto-update off, real HOME (as the judge).
  const env = { ...isolatedClaudeEnv(process.env, p.home, iso), HOME: os.homedir() };

  // Hard cap: the spawn is recorded before it starts.
  const ledger = readLedger(ledgerFile);
  if (ledger.spawns.length >= HARD_CAP) throw new Error(`HARD CAP reached (${String(ledger.spawns.length)}/${String(HARD_CAP)}): no further session`);
  const engine = s.arm === 'X' ? 'agy' : 'claude';
  if (ledger.spawns.filter((x) => (x.engine ?? 'claude') === engine).length >= ENGINE_CAP[engine]) throw new Error(`${engine} cap ${String(ENGINE_CAP[engine])} reached: no further session`);
  const rec = { n: ledger.spawns.length + 1, sid: s.sid, engine, attemptOf: `${s.sid}#${String(attempt)}`, startedAt: new Date().toISOString() } as Ledger['spawns'][number];
  ledger.spawns.push(rec);
  writeLedger(ledger, ledgerFile);

  const t0 = Date.now();
  const r = s.arm === 'X'
    ? await xRunner(runner).run('agy', [prompt], { cwd, env: {}, timeoutMs: TIMEOUT_MS })
    : await runner.run('claude', args, { cwd, env, timeoutMs: TIMEOUT_MS, maxOutputBytes: 64 * 1024 * 1024 });
  const wallMs = Date.now() - t0;
  const cli: ProcessResult | null = r.success ? r.data : null;
  const stdout = cli?.stdout ?? '';
  const envelope = cli === null ? null : (() => { const x = parseEnvelope(stdout, []); return x.success ? x.data : null; })();
  const status = turnStatus(cli, false, envelope, modelFor(s.arm));
  const usage = turnUsage(envelope);
  const processed = usage.inputTokens === null ? null : (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0) + (usage.outputTokens ?? 0);
  const t = analyseTranscript(stdout, cwd);
  const toolCalls: Record<string, number> = {};
  for (const c of t.calls) toolCalls[c.name] = (toolCalls[c.name] ?? 0) + 1;
  const capFlags: string[] = [];
  if ((usage.numTurns ?? 0) > TURN_CAP) capFlags.push(`turns ${String(usage.numTurns)} > ${String(TURN_CAP)}`);
  if (processed !== null && processed > TOKEN_CAP) capFlags.push(`processed tokens ${String(processed)} > ${String(TOKEN_CAP)}`);
  if (cli?.timedOut === true) capFlags.push(`timeout ${String(TIMEOUT_MS)} ms`);

  const dir = path.join(outRoot, 'sessions', s.sid);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'transcript.jsonl'), scrub(stdout));
  fs.writeFileSync(path.join(dir, 'stderr.txt'), scrub((cli?.stderr ?? (r.success ? '' : JSON.stringify(r.errors))).slice(-20_000)));
  if (envelope !== null) fs.writeFileSync(path.join(dir, 'envelope.json'), `${scrub(JSON.stringify(envelope.scrubbed, null, 1))}\n`);
  if (fs.existsSync(p.callLog)) fs.writeFileSync(path.join(dir, 'facts-calls.jsonl'), scrub(fs.readFileSync(p.callLog, 'utf8')));

  const finalText = t.finalResult ?? '';
  fs.writeFileSync(path.join(dir, 'final-message.md'), scrub(finalText));
  const yamlText = lastBlock(finalText, 'ya?ml');
  const jsonText = lastBlock(finalText, 'json');
  const output: SessionMeta['output'] = { yaml: yamlText !== null, json: jsonText !== null, composed: false, specValid: null, specErrors: [], styleKept: null };
  if (yamlText !== null) {
    try {
      const derived = YAML.parse(yamlText) as { architecture?: { style?: string } };
      output.styleKept = derived.architecture?.style === e.style;
      const header = ` BF-01 derived spec: ${s.sid} (arm ${s.arm}, ${modelFor(s.arm)}). Composed by scripts/v1.3/bf-01-run.ts from ${PRESET_FILE[e.style] ?? ''}\n with the model's architecture block, default_exclude_paths and fitness_overrides. Not a declared spec.`;
      fs.writeFileSync(path.join(dir, 'derived.yaml'), compose(e.style, derived as never, header));
      output.composed = true;
      const parsed = await parseSpec({ specFilePath: path.join(dir, 'derived.yaml') });
      output.specValid = parsed.success;
      if (!parsed.success) output.specErrors = parsed.errors.map((x) => scrub(`${x.code}: ${x.message}`)).slice(0, 20);
    } catch (err) {
      output.specErrors = [scrub(err instanceof Error ? err.message : String(err))];
    }
  }
  if (jsonText !== null) {
    try { fs.writeFileSync(path.join(dir, 'evidence.json'), `${JSON.stringify(JSON.parse(jsonText), null, 1)}\n`); } catch (err) {
      fs.writeFileSync(path.join(dir, 'evidence.raw.txt'), scrub(jsonText));
      output.json = false;
      output.specErrors.push(`evidence JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const meta: SessionMeta = {
    sid: s.sid, repo: s.repo, arm: s.arm, run: s.run, attempt, model: modelFor(s.arm), cliVersion,
    status, modelValid: envelope !== null && judgeModelUsage(modelFor(s.arm), envelope.summary).valid, usage, processedTokens: processed, wallMs,
    exitCode: cli?.exitCode ?? null, timedOut: cli?.timedOut ?? null, capFlags, mcp: initMcp(stdout), toolCalls,
    confinementViolations: s.arm === 'X' ? [] : confinement(t.calls, cwd), output,
    evidenceGate: DESIGN === 'v2' ? await evidenceGate(s, dir) : null,
    promptSha256: createHash('sha256').update(prompt).digest('hex'), argv: args.map((a) => (a === prompt ? '<prompt>' : scrub(a))),
    configListingSha256: okIso.data.configListingSha256,
  };
  fs.writeFileSync(path.join(dir, 'prompt.txt'), prompt);
  fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 1)}\n`);
  if (mcpConfig !== null) fs.writeFileSync(path.join(dir, 'mcp-G.json'), `${scrub(JSON.stringify(mcpConfig, null, 1))}\n`);

  const l2 = readLedger(ledgerFile);
  const mine = l2.spawns.find((x) => x.n === rec.n);
  if (mine !== undefined) { mine.endedAt = new Date().toISOString(); mine.status = status; }
  writeLedger(l2, ledgerFile);
  return meta;
}

// ── Arm X: Gemini through the repo's agy labeller route, presented as a stream-json run ─────────────────────────

/** The answer schema of the one-shot X call (agy needs one; the route refuses a call without it). */
export const X_SCHEMA = JSON.stringify({ type: 'object', properties: { spec_yaml: { type: 'string' }, evidence: { type: 'object' } }, required: ['spec_yaml', 'evidence'] });

/** Stub provider of the dry run: answers like the Claude stub, with zero calls. */
class StubXProvider implements LLMProvider {
  readonly name = 'agy-stub';
  async evaluate(prompt: string): Promise<DomainResult<LLMResponse>> {
    const repo = REPOS.find((r) => prompt.includes(entry(r).sha)) ?? REPOS[0];
    const fake = await new StubRunner().run('claude', ['-p', prompt], { cwd: path.join(CLONES, repo), env: {}, timeoutMs: 1 });
    const text = fake.success ? (JSON.parse(fake.data.stdout.trim().split('\n').pop() ?? '{}') as { result: string }).result : '';
    const y = lastBlock(text, 'ya?ml') ?? ''; const j = lastBlock(text, 'json') ?? '{}';
    return DomainResult.ok({ content: JSON.stringify({ spec_yaml: y, evidence: JSON.parse(j) as unknown }), model: GEMINI_MODEL, usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: { model: GEMINI_MODEL }, ignoredOptions: [] });
  }
  describe(): never { return { provider: 'agy-stub', model: GEMINI_MODEL } as never; }
}

/**
 * A ProcessRunner over `AgyCliProvider.evaluate` (the labeller route, unchanged: record-mode pre-flight with the
 * version pin, home check, empty neutral cwd, env allow-list, --sandbox, tools inert). It emits the init and result
 * events a Claude stream-json run would, so `runSession` reads both engines the same way.
 */
export function xRunner(outer: ProcessRunner): ProcessRunner {
  const provider: LLMProvider = outer instanceof StubRunner ? new StubXProvider()
    : new AgyCliProvider({ model: GEMINI_MODEL, home: expandHome(AGY_HOME_DEFAULT), mode: 'record' }, { runner: new NodeProcessRunner() });
  return {
    async run(_c: string, args: readonly string[]): Promise<DomainResult<ProcessResult>> {
      const t0 = Date.now();
      const r = await provider.evaluate(args[0] ?? '', { model: GEMINI_MODEL, maxTokens: 32_000 }, { runIndex: 0, repetition: 0, functionId: 'bf01:derive', responseSchema: X_SCHEMA });
      const init = JSON.stringify({ type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: r.success ? r.data.model : GEMINI_MODEL });
      let result: Record<string, unknown>;
      if (r.success) {
        let final = r.data.content;
        try {
          const o = JSON.parse(r.data.content) as { spec_yaml?: string; evidence?: unknown };
          final = `\`\`\`yaml\n${o.spec_yaml ?? ''}\n\`\`\`\n\n\`\`\`json\n${JSON.stringify(o.evidence ?? {})}\n\`\`\`\n`;
        } catch { /* left as is: extraction then finds no blocks and the session scores as a failure */ }
        result = { type: 'result', subtype: 'success', is_error: false, num_turns: 1, duration_ms: Date.now() - t0, result: final,
          usage: { input_tokens: r.data.usage.inputTokens, output_tokens: r.data.usage.outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          modelUsage: { [r.data.model]: { outputTokens: r.data.usage.outputTokens } } };
      } else {
        result = { type: 'result', subtype: 'error', is_error: true, num_turns: 0, duration_ms: Date.now() - t0, result: r.errors.map((e) => `${e.code}: ${e.message}`).join('; '), modelUsage: {} };
      }
      return DomainResult.ok({ exitCode: r.success ? 0 : 1, stdout: `${init}\n${JSON.stringify(result)}\n`, stderr: '', timedOut: false, durationMs: Date.now() - t0 });
    },
  };
}

// ── Run-time evidence gate (v2) ──────────────────────────────────────────────────────────────────────────────────

/**
 * Checked as soon as the session ends, with the same mechanical checks as bf-01-verify-evidence.ts. A session fails
 * the gate when no citation verifies, when docs were supplied but no doc citation verifies, or (arm G) when no stat
 * citation verifies. A failed gate is an outcome, not an infrastructure failure: the session scores as an invalid
 * spec, it is not retried, and the pilot continues.
 */
export async function evidenceGate(s: PlannedSession, dir: string): Promise<{ pass: boolean; reasons: string[]; verified: Record<string, number> }> {
  const verified: Record<string, number> = { doc: 0, pattern: 0, stat: 0, total: 0, cited: 0 };
  const f = path.join(dir, 'evidence.json');
  const reasons: string[] = [];
  if (!fs.existsSync(f)) return { pass: false, reasons: ['no parseable evidence'], verified };
  const units = ((JSON.parse(fs.readFileSync(f, 'utf8')) as { units?: { citations?: Record<string, unknown>[] }[] }).units ?? []);
  const e = entry(s.repo);
  for (const u of units) for (const c of u.citations ?? []) {
    verified.cited = (verified.cited ?? 0) + 1;
    const r = await checkCitation(c as never, s.repo, e.root);
    if (r.ok) { verified.total = (verified.total ?? 0) + 1; const t = String(c.type); verified[t] = (verified[t] ?? 0) + 1; }
  }
  if ((verified.total ?? 0) === 0) reasons.push('no citation verifies');
  if (docsFor(s.repo).length > 0 && (verified.doc ?? 0) === 0) reasons.push('docs supplied but no doc citation verifies');
  if (s.arm === 'G' && (verified.stat ?? 0) === 0) reasons.push('arm G without a verified stat citation');
  return { pass: reasons.length === 0, reasons, verified };
}

// ── Stub runner (dry run, zero calls) ────────────────────────────────────────────────────────────────────────────

/** Emits the stream-json a real session would, with a canned final message whose citations are computed truthfully. */
export class StubRunner implements ProcessRunner {
  readonly calls: { args: readonly string[]; cwd?: string }[] = [];
  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ args, ...(options.cwd !== undefined ? { cwd: options.cwd } : {}) });
    if (args[0] === '--version') return DomainResult.ok({ exitCode: 0, stdout: '0.0.0-stub (Claude Code)\n', stderr: '', timedOut: false, durationMs: 1 });
    const cwd = options.cwd ?? '.';
    const repo = path.basename(cwd);
    const e = entry(repo);
    const isG = args.includes('--mcp-config');
    const readme = fs.readFileSync(path.join(cwd, 'README.md'), 'utf8').split('\n');
    const lineIdx = readme.findIndex((l) => l.trim().length > 3);
    const preset = YAML.parse(fs.readFileSync(path.join(REPO_ROOT, PRESET_FILE[e.style] ?? ''), 'utf8')) as { architecture: { layers: { name: string }[] } };
    const { execFileSync } = await import('node:child_process');
    const tracked = execFileSync('git', ['-C', path.join(cwd, e.root), 'ls-files', '--', '.'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const pm = (await import('picomatch')).default;
    const count = tracked.filter((f) => pm('src/**', { dot: true })(f)).length;
    const cits: unknown[] = [{ type: 'doc', file: 'README.md', line: lineIdx + 1, quote: (readme[lineIdx] ?? '').trim().slice(0, 40) }, { type: 'pattern', glob: 'src/**', count }];
    if (isG) {
      const g = await buildFactsGraph(path.join(cwd, e.root));
      const q = 'MATCH (a:File)-[:IMPORTS]->(b:File) RETURN count(*) AS numerator, count(DISTINCT a) AS denominator';
      const row = (await readOnlyQuery(g, q)).rows[0] ?? {};
      cits.push({ type: 'stat', query: q, numerator: row.numerator, denominator: row.denominator });
    }
    const units = [...preset.architecture.layers.map((l) => ({ id: `layer:${l.name}`, claim: 'stub', origin: 'proposed', citations: cits })), { id: 'order', claim: 'stub', origin: 'proposed', citations: [{ type: 'doc', file: 'README.md', line: 1, quote: 'certainly-not-on-line-1 \u0000' }] }];
    const final = `Stub derivation.\n\n\`\`\`yaml\n${YAML.stringify({ architecture: (preset as { architecture: unknown }).architecture })}\`\`\`\n\n\`\`\`json\n${JSON.stringify({ units })}\n\`\`\`\n`;
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', tools: isG ? ['Read', 'Grep', 'Glob', ...FACT_TOOLS.map((t) => `mcp__${FACTS_SERVER}__${t}`)] : ['Read', 'Grep', 'Glob'], mcp_servers: isG ? [{ name: FACTS_SERVER, status: 'connected' }] : [], model: MODEL }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_stub_0', name: 'Read', input: { file_path: path.join(cwd, 'README.md') } }] } }),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_stub_0', content: [{ type: 'text', text: '(readme)' }] }] } }),
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 2, duration_ms: 5, total_cost_usd: 0, result: final, usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, modelUsage: { [MODEL]: { outputTokens: 100 } } }),
    ];
    return DomainResult.ok({ exitCode: 0, stdout: `${lines.join('\n')}\n`, stderr: '', timedOut: false, durationMs: 5 });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────────────────────

async function cliVersionOf(runner: ProcessRunner): Promise<string | null> {
  const iso = { configDir: JUDGE_CONFIG_DIR_DEFAULT.replace(/^~/, os.homedir()) };
  const home = path.join(HARNESS, 'probe-home');
  const ok = checkIsolationBeforeSpawn(home, iso);
  if (!ok.success) throw new Error(`isolation: ${JSON.stringify(ok.errors.map((x) => x.code))}`);
  const r = await runner.run('claude', ['--version'], { env: isolatedClaudeEnv(process.env, home, iso), timeoutMs: 30_000 });
  return r.success ? parseCliVersion(r.data.stdout) : null;
}

async function factsSmoke(): Promise<unknown[]> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const out: unknown[] = [];
  for (const repo of REPOS) {
    const e = entry(repo);
    const t = new StdioClientTransport({ command: TSX, args: [SERVER, '--project', path.join(CLONES, repo, e.root)], cwd: path.join(CLONES, repo), stderr: 'ignore' });
    const c = new Client({ name: 'bf01-dry-run', version: '0' });
    await c.connect(t);
    const tools = (await c.listTools()).tools.map((x) => x.name);
    const q = await c.callTool({ name: 'query_graph', arguments: { cypher: 'MATCH (f:File) RETURN count(f) AS numerator, 1 AS denominator' } });
    const w = await c.callTool({ name: 'query_graph', arguments: { cypher: 'MATCH (n) DETACH DELETE n' } });
    out.push({ repo, tools, filesInGraph: JSON.parse((q.content as { text: string }[])[0]?.text ?? '{}') as unknown, writeRefused: w.isError === true });
    await c.close();
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const live = argv.includes('--run');
  const sessions = plan();
  fs.mkdirSync(OUT, { recursive: true });
  const planDoc = {
    design: DESIGN === 'v1' ? 'ops/notes/bf-01-brownfield-norm-derivation.md §7' : 'ops/notes/bf-01-brownfield-norm-derivation.md "v2 after pilot"', designVersion: DESIGN,
    models: Object.fromEntries(ALL_ARMS.map((a) => [a, modelFor(a)])), repos: REPOS, arms: ALL_ARMS, runs: RUNS,
    sessions: sessions.length, sessionsByEngine: { claude: sessions.filter((x) => x.arm !== 'X').length, agy: sessions.filter((x) => x.arm === 'X').length }, engineCaps: ENGINE_CAP, retryCeiling: `${String(RETRY_PER_ARM)} per arm (infrastructure, timeout, unreadable envelope only)`, hardCap: HARD_CAP,
    caps: { timeoutMs: TIMEOUT_MS, turns: `${String(TURN_CAP)} (after the fact)`, processedTokens: `${String(TOKEN_CAP)} (after the fact)` },
    order: sessions.map((s) => s.sid),
    argv: Object.fromEntries(ALL_ARMS.map((a) => [a, argvFor(sessions.find((s) => s.arm === a)!, '<prompt>').args.map(scrub)])),
    promptChars: Object.fromEntries(sessions.filter((x) => x.run === 1).map((x) => [x.sid, frame(x.repo, x.arm).length])),
    docsSupplied: Object.fromEntries(REPOS.map((r) => [r, DESIGN === 'v2' ? docsFor(r).map((d) => `${d.file}${d.truncated ? ' (truncated)' : ''}`) : []])),
  };
  fs.writeFileSync(path.join(OUT, 'plan.json'), `${JSON.stringify(planDoc, null, 1)}\n`);
  process.stdout.write(`BF-01 pilot plan (${DESIGN}): ${String(sessions.length)} sessions = ${String(REPOS.length)} repos x ${String(ALL_ARMS.length)} arms (${ALL_ARMS.join(', ')}) x ${String(RUNS)} runs; Claude ${String(planDoc.sessionsByEngine.claude)}, Gemini ${String(planDoc.sessionsByEngine.agy)}; hard cap ${String(HARD_CAP)} spawns (Claude ${String(ENGINE_CAP.claude)}, Gemini ${String(ENGINE_CAP.agy)})\n`);
  for (const s of sessions) process.stdout.write(`  ${String(s.order).padStart(2)}. ${s.sid}\n`);
  for (const [a, v] of Object.entries(planDoc.argv)) process.stdout.write(`argv ${a}: ${a === 'X' ? '' : 'claude '}${(v as string[]).join(' ')}\n`);
  process.stdout.write(`docs supplied: ${JSON.stringify(planDoc.docsSupplied)}; prompt chars (run 1): ${JSON.stringify(planDoc.promptChars)}\n`);

  if (dry) {
    const real = new NodeProcessRunner();
    const version = await cliVersionOf(real);
    process.stdout.write(`isolation listing check: pass; claude --version (no model call): ${String(version)}\n`);
    process.stdout.write(`fact server smoke: ${JSON.stringify(await factsSmoke())}\n`);
    const stub = new StubRunner();
    const dryOut = path.join(OUT, 'dry-run');
    fs.rmSync(dryOut, { recursive: true, force: true });
    const dryLedger = path.join(dryOut, 'ledger.json');
    for (const s of sessions.filter((x) => x.run === 1)) {
      const m = await runSession(s, stub, dryOut, 1, dryLedger, 'stub');
      process.stdout.write(`stub ${s.sid}: status ${m.status}, modelValid ${String(m.modelValid)}, specValid ${String(m.output.specValid)}, confinement ${String(m.confinementViolations.length)}, gate ${JSON.stringify(m.evidenceGate)}, mcp ${JSON.stringify((m.mcp as { mcp_servers?: unknown } | null)?.mcp_servers ?? null)}\n`);
    }
    if (DESIGN === 'v2') {
      const neg = path.join(dryOut, 'gate-negative');
      fs.mkdirSync(neg, { recursive: true });
      fs.writeFileSync(path.join(neg, 'evidence.json'), JSON.stringify({ units: [{ id: 'layer:domain', citations: [] }] }));
      const g0 = await evidenceGate(sessions.find((x) => x.arm === 'G')!, neg);
      fs.writeFileSync(path.join(neg, 'evidence.json'), JSON.stringify({ units: [{ id: 'layer:domain', citations: [{ type: 'pattern', glob: 'src/**', count: trackedUnderRoot(REPOS[0]).filter((f) => f.startsWith('src/')).length }] }] }));
      const g1 = await evidenceGate(sessions.find((x) => x.arm === 'R')!, neg);
      process.stdout.write(`gate negative controls: zero citations -> pass ${String(g0.pass)} (${g0.reasons.join('; ')}); pattern only, docs supplied -> pass ${String(g1.pass)} (${g1.reasons.join('; ')})\n`);
      const agy = await checkAgyIsolation({ runner: new NodeProcessRunner(), home: expandHome(AGY_HOME_DEFAULT) });
      process.stdout.write(`agy pre-flight (repo route, zero model calls): ${agy.success ? 'pass' : agy.errors.map((x) => `${x.code}: ${x.message}`).join('; ')}\n`);
    }
    process.stdout.write(`dry run: 0 model calls; stub spawns ${String(stub.calls.length)}; live ledger spawns ${String(readLedger().spawns.length)}\n`);
    return;
  }
  if (!live) return;

  const runner = new NodeProcessRunner();
  const version = await cliVersionOf(runner);
  if (ARMS.includes('X')) {
    const agy = await checkAgyIsolation({ runner, home: expandHome(AGY_HOME_DEFAULT) });
    process.stdout.write(`agy pre-flight (zero model calls): ${agy.success ? 'pass' : agy.errors.map((x) => x.code).join(', ')}\n`);
    if (!agy.success) { process.stdout.write('arm X cannot run through the labeller route; no session started (pass --arms G,R to run the Claude arms only)\n'); return; }
  }
  {
    const iso = { configDir: JUDGE_CONFIG_DIR_DEFAULT.replace(/^~/, os.homedir()) };
    const env = { ...isolatedClaudeEnv(process.env, path.join(HARNESS, 'probe-home'), iso), HOME: os.homedir() };
    const a = await runner.run('claude', ['auth', 'status'], { env, timeoutMs: 30_000 });
    const logged = a.success && /"loggedIn":\s*true/.test(a.data.stdout);
    process.stdout.write(`auth preflight (zero calls): loggedIn ${String(logged)}\n`);
    if (!logged) { process.stdout.write('not logged in under the judge config dir: no session started\n'); return; }
  }
  const retries: Record<Arm, number> = { G: 0, R: 0, X: 0 };
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : undefined;
  for (const s of sessions.filter((x) => ARMS.includes(x.arm) && (only === undefined || x.sid === only))) {
    const metaFile = path.join(OUT, 'sessions', s.sid, 'meta.json');
    if (fs.existsSync(metaFile)) {
      const m = JSON.parse(fs.readFileSync(metaFile, 'utf8')) as SessionMeta;
      if (!RETRYABLE.has(m.status)) { process.stdout.write(`skip ${s.sid} (done: ${m.status})\n`); continue; }
    }
    let attempt = 1;
    for (;;) {
      if (readLedger().spawns.length >= HARD_CAP) { process.stdout.write(`HARD CAP ${String(HARD_CAP)} reached; stopping before ${s.sid}\n`); return; }
      process.stdout.write(`[${new Date().toISOString()}] start ${s.sid} attempt ${String(attempt)} (spawn ${String(readLedger().spawns.length + 1)}/${String(HARD_CAP)})\n`);
      const m = await runSession(s, runner, OUT, attempt, LEDGER, version);
      process.stdout.write(`[${new Date().toISOString()}] end ${s.sid}: ${m.status} turns=${String((m.usage as { numTurns: unknown }).numTurns)} tokens=${String(m.processedTokens)} wall=${String(Math.round(m.wallMs / 1000))}s spec=${String(m.output.specValid)} conf=${String(m.confinementViolations.length)} tools=${JSON.stringify(m.toolCalls)}\n`);
      const finalText = fs.readFileSync(path.join(OUT, 'sessions', s.sid, 'final-message.md'), 'utf8');
      if (m.status === 'agent-error' && /limit|quota|rate/i.test(finalText)) { process.stdout.write('usage or rate limit reported: stopping the pilot (no retry)\n'); return; }
      // Fail fast (added after the 2026-10-19 run, where a logged-out config dir burned 12 spawns): any session that
      // did not complete with the pinned model, or a G session whose fact server is not connected, stops the pilot.
      const servers = ((m.mcp as { mcp_servers?: { name: string; status: string }[] } | null)?.mcp_servers ?? []);
      const expected = s.arm === 'G' ? [FACTS_SERVER] : [];
      if (JSON.stringify(servers.map((x) => x.name).sort()) !== JSON.stringify(expected)) { process.stdout.write(`unexpected MCP servers ${JSON.stringify(servers)}: stopping\n`); return; }
      if (s.arm === 'G' && !servers.some((x) => x.name === FACTS_SERVER && x.status === 'connected')) { process.stdout.write(`G session without a connected ${FACTS_SERVER} server: stopping\n`); return; }
      if (/not logged in|\/login/i.test(finalText)) { process.stdout.write('CLI not logged in under the judge config dir: stopping\n'); return; }
      if (!RETRYABLE.has(m.status) && (m.status !== 'completed' || !m.modelValid)) { process.stdout.write(`session status ${m.status}: stopping the pilot\n`); return; }
      if (RETRYABLE.has(m.status) && retries[s.arm] < RETRY_PER_ARM) {
        retries[s.arm]++;
        fs.renameSync(path.join(OUT, 'sessions', s.sid), path.join(OUT, 'sessions', `${s.sid}.failed-attempt-${String(attempt)}`));
        attempt++;
        continue;
      }
      break;
    }
  }
  process.stdout.write(`done; spawns used ${String(readLedger().spawns.length)}/${String(HARD_CAP)}\n`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve('scripts/v1.3/bf-01-run.ts')) {
  main().catch((e: unknown) => { process.stderr.write(`${scrub(e instanceof Error ? e.stack ?? e.message : String(e))}\n`); process.exit(1); });
}
