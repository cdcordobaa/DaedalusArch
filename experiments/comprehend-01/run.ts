/**
 * COMPREHEND-01 runner (design §10, §12). Dry run by default: a scripted fake model answers every session, so the
 * plan, the argv, the MCP configs, the confinement checks, the re-runs, the hard cap, the scoring and the ledger are
 * exercised with zero model calls.
 *
 *   npx tsx experiments/comprehend-01/run.ts --clones <dir> [--out <dir>]            # dry run → results/dry-run/
 *   npx tsx experiments/comprehend-01/run.ts --clones <dir> --live --confirm-sessions 62 --claude <bin> --config-dir <abs> --bank-sha256 <sha>
 *     [--hard-cap 64] [--isolation <json>] [--harness <dir>]                      # R1: the pilot's cap and isolated layout
 *
 * The live path is for the pilot, after the author approves the design note; it also needs COMPREHEND01_LIVE=1.
 * Every session runs from its tree's root. Cap: 62 planned sessions plus 4 re-runs (66); a 67th spawn is refused.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { isOutsideTree, readTranscript, toolCallCounts } from '../../scripts/v1.3/lib/eff01/transcript.js';
import { tokensFromEnvelope, tokensFromPartial } from '../../scripts/v1.3/lib/eff01/tokens.js';
import { COMPREHEND_SERVER_NAME } from '../detect-02/mcp/comprehend-server.js';
import type { McpConfigFile } from '../../scripts/lib/generators/arms.js';
import { armArgs, ARMS, buildPrompt, CALIBRATION_PROMPT, CAPS, FRAME_SHA256, graphMcpConfig, MODEL } from './lib/arms.js';
import type { Arm } from './lib/arms.js';
import { HERE, loadBank, readJson, resolveTrees, scrubber, sha256 } from './lib/bank.js';
import type { Item, ResolvedTree } from './lib/bank.js';
import { FakeModelRunner, LiveRunner } from './lib/runners.js';
import type { FakeBehaviour, FakeScript, SessionRunner } from './lib/runners.js';
import { scoreText } from './lib/score.js';

export const SEED = 20261022;
export const RERUN_ALLOWANCE = 4;
export const PLANNED_SESSIONS = 62;
export const HARD_CAP = PLANNED_SESSIONS + RERUN_ALLOWANCE;
const SERVER_ENTRY = path.resolve('experiments/detect-02/mcp/comprehend-main.ts');

export interface Cell { readonly sessionId: string; readonly block: 'calibration' | 'pilot'; readonly arm: Arm; readonly item: string | null; readonly tree: string }

/** mulberry32: a small seeded PRNG, so the order is reproducible from the seed alone. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function plan(items: readonly Item[]): Cell[] {
  const cal: Cell[] = ARMS.map((arm) => ({ sessionId: `cal-${arm}`, block: 'calibration', arm, item: null, tree: 'p2-seed' }));
  const cells: Cell[] = items.flatMap((i) => ARMS.map((arm) => ({ sessionId: `${i.id}-${arm}`, block: 'pilot' as const, arm, item: i.id, tree: i.tree })));
  const r = rng(SEED);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j]!, cells[i]!]; }
  return [...cal, ...cells];
}

/** Confinement (design §9 item 7): F may call no MCP tool; FG only this server's tools; file tools stay in the tree. */
export function confinement(arm: Arm, toolUses: readonly { name: string; input: Readonly<Record<string, unknown>> }[], treeDir: string): string[] {
  const out: string[] = [];
  for (const u of toolUses) {
    if (u.name.startsWith('mcp__')) {
      if (arm === 'F') out.push(`F called ${u.name}`);
      else if (!u.name.startsWith(`mcp__${COMPREHEND_SERVER_NAME}__`)) out.push(`FG called another server's tool ${u.name}`);
      continue;
    }
    if (!['Read', 'Grep', 'Glob'].includes(u.name)) { out.push(`built-in tool ${u.name} is not allowed`); continue; }
    for (const k of ['file_path', 'path']) {
      const v = u.input[k];
      if (typeof v === 'string' && v !== '' && isOutsideTree(v, treeDir)) out.push(`${u.name} outside the tree`);
    }
  }
  return out;
}

export interface LedgerRow {
  readonly sessionId: string; readonly attempt: number; readonly block: string; readonly arm: Arm; readonly item: string | null; readonly tree: string;
  readonly itemClass: string | null; readonly itemType: string | null;
  readonly promptSha256: string; readonly argvSha256: string; readonly exitCode: number; readonly wallMs: number; readonly durationMs: number | null;
  readonly turns: number | null; readonly processedTokens: number; readonly outputTokens: number; readonly usageMismatch: boolean;
  readonly toolCalls: number; readonly toolCallsByName: Record<string, number>; readonly graphCalls: number;
  readonly confinement: readonly string[]; readonly valid: boolean; readonly capHit: string | null;
  readonly parse: string; readonly primary: number; readonly secondary: number; readonly detail: string;
}

/**
 * Revision R1 (2026-10-22, before any call; `revisions.md`): the isolated live layout. Each session runs as the
 * unprivileged generator user from a copy of its tree (`treeDirs`), and an FG session's MCP config names only a neutral
 * id (`sNN`) and a root-owned launcher that the generator may run through sudo; the real server config, the call log and
 * the repository stay root-only.
 */
export interface Isolation {
  readonly treeDirs: Readonly<Record<string, string>>;
  readonly launcher: string;
  readonly serverConfigDir: string;
  readonly clientConfigDir: string;
}

interface RunOptions {
  readonly out: string; readonly runner: SessionRunner; readonly clones: string | undefined; readonly harness: string;
  /** Tests only: run the cells of these trees (the planned-count check is skipped). */
  readonly onlyTrees?: readonly string[];
  /** A lower hard cap (tests; the pilot's 64, revision R1). */
  readonly hardCap?: number;
  readonly isolation?: Isolation;
}

/** The tree a session sees: the resolved tree, or its isolated copy (R1). */
export function sessionTree(tree: ResolvedTree, isolation: Isolation | undefined): ResolvedTree {
  const dir = isolation?.treeDirs[tree.decl.id];
  if (isolation === undefined) return tree;
  if (dir === undefined || !path.isAbsolute(dir)) throw new Error(`${tree.decl.id}: no absolute isolated copy`);
  return { ...tree, dir, tsconfig: tree.tsconfig !== undefined ? path.join(dir, path.relative(tree.dir, tree.tsconfig)) : undefined };
}

/** R1: the generator-visible MCP config of a neutral id: sudo runs the root-owned launcher, which reads the real config. */
export function launcherMcpConfig(launcher: string, neutral: string): McpConfigFile {
  return { mcpServers: { [COMPREHEND_SERVER_NAME]: { type: 'stdio', command: '/usr/bin/sudo', args: ['-n', launcher, neutral], env: {} } } };
}

export async function runAll(opts: RunOptions): Promise<{ rows: LedgerRow[]; refused: string[]; spawns: number }> {
  const { bank, conventions } = loadBank();
  const { trees, problems } = resolveTrees(opts.clones);
  const needed = (id: string): boolean => opts.onlyTrees === undefined || opts.onlyTrees.includes(id);
  const blocking = problems.filter((p) => needed(p.split(':')[0]!));
  if (blocking.length > 0) throw new Error(blocking.join('; '));
  const items = new Map(bank.items.map((i) => [i.id, i] as const));
  const cells = plan(bank.items).filter((c) => needed(c.tree));
  if (opts.onlyTrees === undefined && cells.length !== PLANNED_SESSIONS) throw new Error(`plan has ${cells.length} sessions, expected ${PLANNED_SESSIONS}`);
  const hardCap = Math.min(opts.hardCap ?? HARD_CAP, HARD_CAP);
  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'plan.json'), `${JSON.stringify({ schema: 'comprehend-01-plan/v1', seed: SEED, frameSha256: FRAME_SHA256, model: MODEL, caps: CAPS, hardCap, cells }, null, 1)}\n`);
  const rows: LedgerRow[] = [];
  const refused: string[] = [];
  let spawns = 0; let reruns = 0;
  const ledger = path.join(opts.out, 'ledger.jsonl');
  fs.writeFileSync(ledger, '');
  for (const [cellIndex, cell] of cells.entries()) {
    const tree = sessionTree(trees.get(cell.tree)!, opts.isolation);
    const item = cell.item ? items.get(cell.item)! : null;
    const prompt = item ? buildPrompt(cell.arm, item, fs.readFileSync(tree.spec, 'utf8'), conventions) : CALIBRATION_PROMPT;
    const key = cell.sessionId;
    let mcpPath: string | undefined;
    if (cell.arm === 'FG') {
      const cfg = graphMcpConfig({ nodeBinary: process.execPath, entry: SERVER_ENTRY, spec: tree.spec, tree: tree.dir, tsconfig: tree.tsconfig, callLog: path.join(opts.harness, 'calls', `${key}.jsonl`) });
      if (!cfg.ok) throw new Error(`${key}: ${cfg.errors.join('; ')}`);
      mcpPath = path.join(opts.harness, 'mcp', `${key}.json`);
      fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
      fs.mkdirSync(path.join(opts.harness, 'calls'), { recursive: true });
      fs.writeFileSync(mcpPath, `${JSON.stringify(cfg.config, null, 1)}\n`);
      if (opts.isolation !== undefined) {
        const neutral = `s${String(cellIndex + 1).padStart(2, '0')}`;
        const iso = opts.isolation;
        fs.writeFileSync(path.join(iso.serverConfigDir, `${neutral}.json`), `${JSON.stringify({ ...cfg.config.mcpServers[COMPREHEND_SERVER_NAME], sessionId: key }, null, 1)}\n`, { mode: 0o600 });
        mcpPath = path.join(iso.clientConfigDir, `${neutral}.json`);
        fs.writeFileSync(mcpPath, `${JSON.stringify(launcherMcpConfig(iso.launcher, neutral), null, 1)}\n`, { mode: 0o644 });
      }
    }
    const argv = armArgs(cell.arm, prompt, mcpPath);
    if (!argv.ok) throw new Error(`${key}: ${argv.errors.join('; ')}`);
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (spawns >= hardCap) { refused.push(`${key}#${attempt}: hard cap ${hardCap} reached`); break; }
      if (attempt === 2) { if (reruns >= RERUN_ALLOWANCE) { refused.push(`${key}#2: re-run allowance spent`); break; } reruns++; }
      spawns++;
      const res = await opts.runner.run({ sessionId: key, arm: cell.block === 'calibration' ? (`calibration-${cell.arm}` as const) : cell.arm, args: argv.args, cwd: tree.dir, timeoutMs: CAPS.wallMs, attempt });
      fs.mkdirSync(path.join(opts.harness, 'transcripts'), { recursive: true });
      fs.writeFileSync(path.join(opts.harness, 'transcripts', `${key}.${attempt}.jsonl`), res.stdout);
      const t = readTranscript(res.stdout);
      const env = t.resultEvent;
      const tok = env ? tokensFromEnvelope(env, MODEL) : null;
      const tokens = tok ?? tokensFromPartial(t, MODEL);
      const turns = env && typeof env.num_turns === 'number' ? env.num_turns : null;
      const conf = confinement(cell.arm, t.toolUses, tree.dir);
      const counts = toolCallCounts(t);
      const capHit = res.timedOut ? 'wall' : turns !== null && turns > CAPS.turns ? 'turns' : tokens.processed > CAPS.tokens ? 'tokens' : null;
      const s = item ? scoreText(item, t.lastAssistantText) : { parse: 'n/a', primary: 0, secondary: 0, detail: 'calibration' };
      const row: LedgerRow = {
        sessionId: key, attempt, block: cell.block, arm: cell.arm, item: cell.item, tree: cell.tree, itemClass: item?.class ?? null, itemType: item?.type ?? null,
        promptSha256: sha256(prompt), argvSha256: sha256(JSON.stringify(argv.args.map((a) => (a === prompt ? '<prompt>' : a === mcpPath ? '<mcp-config>' : a)))),
        exitCode: res.exitCode, wallMs: res.ms, durationMs: env && typeof env.duration_ms === 'number' ? env.duration_ms : null, turns,
        processedTokens: tokens.processed, outputTokens: tokens.output, usageMismatch: tokens.usageMismatch,
        toolCalls: counts.total, toolCallsByName: counts.byName, graphCalls: Object.entries(counts.byName).filter(([n]) => n.startsWith(`mcp__${COMPREHEND_SERVER_NAME}__`)).reduce((a, [, v]) => a + v, 0),
        confinement: conf, valid: conf.length === 0, capHit,
        parse: s.parse, primary: capHit ? 0 : s.primary, secondary: capHit ? 0 : s.secondary, detail: capHit ? `cap hit (${capHit})` : s.detail,
      };
      rows.push(row);
      fs.appendFileSync(ledger, `${JSON.stringify(row)}\n`);
      // R1: a failed calibration smoke (no clean exit or no result envelope) stops the pilot before any question.
      if (cell.block === 'calibration' && (res.exitCode !== 0 || !env || res.timedOut)) { refused.push(`${key}: calibration smoke failed, the pilot stops (R1)`); break; }
      if (row.valid) break;
      if (attempt === 2) refused.push(`${key}: second confinement leak, the pilot stops (design §9 item 7)`);
    }
    if (refused.some((r) => r.includes('the pilot stops'))) break;
  }
  return { rows, refused, spawns };
}

/** Summary (design §7): per arm, per class, per type; token ratio; diagnosis candidates for wrong FG answers. */
export function summarise(rows: readonly LedgerRow[], graphCheck: { rows: { id: string; primary?: number; graph?: string }[] } | null): Record<string, unknown> {
  const final = new Map<string, LedgerRow>();
  for (const r of rows) final.set(r.sessionId, r); // the last attempt counts
  const scored = [...final.values()].filter((r) => r.block === 'pilot' && r.valid);
  const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null);
  const by = (f: (r: LedgerRow) => string): Record<string, Record<string, unknown>> => {
    const out: Record<string, Record<string, unknown>> = {};
    for (const k of [...new Set(scored.map(f))].sort()) {
      const g = scored.filter((r) => f(r) === k);
      out[k] = Object.fromEntries(ARMS.map((a) => { const x = g.filter((r) => r.arm === a); return [a, { n: x.length, accuracy: mean(x.map((r) => r.primary)), secondary: mean(x.map((r) => r.secondary)) }]; }));
    }
    return out;
  };
  const items = [...new Set(scored.map((r) => r.item!))];
  const pairs = items.map((i) => ({ i, f: scored.find((r) => r.item === i && r.arm === 'F'), g: scored.find((r) => r.item === i && r.arm === 'FG') })).filter((p) => p.f && p.g);
  const nonGw = pairs.filter((p) => p.f!.itemClass !== 'Gw');
  const ratio = (ps: typeof pairs): number | null => {
    const lr = ps.filter((p) => p.f!.processedTokens > 0 && p.g!.processedTokens > 0).map((p) => Math.log(p.g!.processedTokens / p.f!.processedTokens));
    return lr.length ? Math.round(Math.exp(lr.reduce((a, b) => a + b, 0) / lr.length) * 1000) / 1000 : null;
  };
  const graphRight = new Map((graphCheck?.rows ?? []).map((r) => [r.id, r.graph === 'n/a' ? null : r.primary === 1] as const));
  const diagnosis = scored.filter((r) => r.arm === 'FG' && r.primary < 1).map((r) => {
    const g = graphRight.get(r.item!);
    const code = r.graphCalls === 0 ? 'D4' : g === false ? 'D1 or D2 (the tool output is wrong or incomplete for this item: read which)' : g === true ? 'D3 (the tool was right: read the transcript)' : 'to read (no tool answers this item type)';
    return { item: r.item, class: r.itemClass, detail: r.detail, graphCalls: r.graphCalls, candidate: code };
  });
  return {
    sessions: rows.length, scoredPilotSessions: scored.length, invalid: rows.filter((r) => !r.valid).map((r) => `${r.sessionId}#${r.attempt}: ${r.confinement.join('; ')}`),
    capHits: rows.filter((r) => r.capHit).map((r) => `${r.sessionId}: ${r.capHit}`),
    formatFailures: scored.filter((r) => r.parse === 'missing' || r.parse === 'unparsable').map((r) => r.sessionId),
    accuracy: Object.fromEntries(ARMS.map((a) => [a, mean(scored.filter((r) => r.arm === a).map((r) => r.primary))])),
    accuracyNonGw: Object.fromEntries(ARMS.map((a) => [a, mean(scored.filter((r) => r.arm === a && r.itemClass !== 'Gw').map((r) => r.primary))])),
    meanDifferenceNonGw: mean(nonGw.map((p) => p.g!.primary - p.f!.primary)),
    tokenRatioFGoverF: { all: ratio(pairs), nonGw: ratio(nonGw) },
    toolCallsMean: Object.fromEntries(ARMS.map((a) => [a, mean(scored.filter((r) => r.arm === a).map((r) => r.toolCalls))])),
    graphCallsMeanFG: mean(scored.filter((r) => r.arm === 'FG').map((r) => r.graphCalls)),
    fgSessionsWithoutGraphCall: scored.filter((r) => r.arm === 'FG' && r.graphCalls === 0).length,
    byClass: by((r) => r.itemClass ?? '?'), byType: by((r) => r.itemType ?? '?'), byTree: by((r) => r.tree),
    diagnosis,
  };
}

// ── The dry run's script: what the fake model does in each session ──────────────────────────────────────────────────

export function dryRunScript(items: readonly Item[], graphCheck: { rows: { id: string; graphAnswer?: Record<string, unknown>; via?: string }[] }, trees: Map<string, ResolvedTree>): FakeScript {
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const graph = new Map(graphCheck.rows.map((r) => [r.id, r] as const));
  const parse = (sid: string): { item: Item | undefined; arm: Arm } => {
    const arm: Arm = sid.endsWith('-FG') ? 'FG' : 'F';
    return { item: byId.get(sid.replace(/-(FG|F)$/, '')), arm };
  };
  // Scripted departures from "answer the key", chosen to exercise every path of the scorer and the ledger.
  const special: Record<string, Record<number, FakeBehaviour>> = {
    'P2-C1-F': { 1: 'wrong' },        // F gets a chain wrong
    'LH-I1-F': { 1: 'no-answer' },    // a format failure
    'DF-I1-F': { 1: 'wrong' },        // F misses importers in the large repo
    'MT-O1-FG': { 1: 'no-graph' },    // FG answers without a graph call (D4 if wrong; here right)
    'P1-R1-FG': { 1: 'wrong' },       // FG wrong on an X item (to read)
    'DF-P1-FG': { 1: 'leak-outside-tree', 2: 'answer' }, // a confinement leak, then a valid re-run
    'P4-I1-F': { 1: 'over-turns' },   // a turn-cap hit
  };
  return {
    answerFor(sid) {
      const { item, arm } = parse(sid);
      if (!item) return null;
      const g = graph.get(item.id);
      // FG trusts the graph whenever a tool answers the item (so Gw items come out wrong, as the design predicts).
      if (arm === 'FG' && g?.graphAnswer) return g.graphAnswer;
      return item.key;
    },
    behaviourFor(sid, attempt) { return special[sid]?.[attempt] ?? 'answer'; },
    graphCallsFor(sid) {
      const { item } = parse(sid);
      if (!item) return [];
      const via = graph.get(item.id)?.via ?? 'context_map';
      const tool = (['who_writes', 'trace', 'impact', 'context_map'].find((t) => via.startsWith(t)) ?? 'context_map');
      return [{ name: 'context_map', input: {} }, ...(tool !== 'context_map' ? [{ name: tool, input: { via } }] : [])];
    },
    readsFor(sid) {
      const { item } = parse(sid);
      return item ? [...item.text.matchAll(/(src\/[A-Za-z0-9_./-]+\.ts)/g)].map((m) => m[1]!).slice(0, 2) : [];
    },
    usageFor(sid) {
      const { item, arm } = parse(sid);
      const t = item ? trees.get(item.tree) : undefined;
      const files = t ? fs.readdirSync(t.dir, { recursive: true }).filter((f) => String(f).endsWith('.ts')).length : 20;
      // Fake numbers, only to exercise the token plumbing: reading grows with the tree, the graph arm pays a fixed overhead.
      return arm === 'FG' ? { input: 900, cacheCreation: 7000, cacheRead: 3000 + files * 40, output: 400 } : { input: 900, cacheCreation: 5000, cacheRead: 2000 + files * 160, output: 500 };
    },
  };
}

/** Starts the comprehension server exactly as an FG session's MCP config does, and lists its tools (no model call). */
export async function serverSmoke(tree: ResolvedTree, harness: string): Promise<{ tree: string; tools: string[]; contextMapOk: boolean; ms: number }> {
  const cfg = graphMcpConfig({ nodeBinary: process.execPath, entry: SERVER_ENTRY, spec: tree.spec, tree: tree.dir, tsconfig: tree.tsconfig, callLog: path.join(harness, 'calls', `smoke-${tree.decl.id}.jsonl`) });
  if (!cfg.ok) throw new Error(cfg.errors.join('; '));
  const s = cfg.config.mcpServers[COMPREHEND_SERVER_NAME]!;
  fs.mkdirSync(path.join(harness, 'calls'), { recursive: true });
  const t0 = Date.now();
  const transport = new StdioClientTransport({ command: s.command, args: [...s.args], cwd: path.resolve('.'), stderr: 'ignore' });
  const client = new Client({ name: 'comprehend-01-smoke', version: '0' });
  await client.connect(transport);
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  const r = await client.callTool({ name: 'context_map', arguments: {} });
  await client.close();
  return { tree: tree.decl.id, tools, contextMapOk: r.isError !== true, ms: Date.now() - t0 };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const clones = arg('clones');
  const live = argv.includes('--live');
  const harness = arg('harness') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'comprehend-01-'));
  const hardCap = arg('hard-cap') !== undefined ? Number(arg('hard-cap')) : HARD_CAP;
  if (!Number.isInteger(hardCap) || hardCap < 1 || hardCap > HARD_CAP) { process.stderr.write(`--hard-cap must be an integer in 1..${HARD_CAP}\n`); return 2; }
  const isoPath = arg('isolation');
  const isolation = isoPath !== undefined ? readJson<Isolation>(isoPath) : undefined;
  const { bank, sha256: bankSha } = loadBank();
  const { trees, problems } = resolveTrees(clones);
  if (problems.length > 0) { process.stderr.write(`${problems.join('\n')}\n`); return 2; }
  let runner: SessionRunner;
  const gcPath = path.join(HERE, 'results', 'graph-check.json');
  const graphCheck = fs.existsSync(gcPath) ? readJson<{ bankSha256: string; rows: { id: string; graphAnswer?: Record<string, unknown>; via?: string; primary?: number; graph?: string }[] }>(gcPath) : null;
  if (live) {
    const confirm = Number(arg('confirm-sessions'));
    const claude = arg('claude'); const configDir = arg('config-dir');
    const why = process.env.COMPREHEND01_LIVE !== '1' ? 'COMPREHEND01_LIVE=1 is not set'
      : confirm !== PLANNED_SESSIONS ? `--confirm-sessions must equal the planned ${PLANNED_SESSIONS}`
      : arg('bank-sha256') !== bankSha ? '--bank-sha256 must equal the frozen bank\'s SHA-256'
      : claude === undefined || configDir === undefined || !path.isAbsolute(configDir) ? '--claude and an absolute --config-dir are required'
      : null;
    if (why !== null) { process.stderr.write(`live run refused: ${why}\n`); return 2; }
    runner = new LiveRunner(claude!, configDir!, path.dirname(configDir!));
  } else {
    if (graphCheck === null) { process.stderr.write('run graph-check.ts first (the dry run scripts FG from its graph answers)\n'); return 2; }
    runner = new FakeModelRunner(dryRunScript(bank.items, graphCheck, trees));
  }
  const out = arg('out') ?? path.join(HERE, 'results', live ? 'pilot' : 'dry-run');
  const smoke = live ? [] : [await serverSmoke(trees.get('p2-seed')!, harness), await serverSmoke(trees.get('ddd-forum') ?? trees.get('p1-seed')!, harness)];
  const { rows, refused, spawns } = await runAll({ out, runner, clones, harness, hardCap, isolation });
  const summary = summarise(rows, graphCheck);
  const scrub = scrubber([path.resolve('.'), path.resolve(clones ?? '/nonexistent'), harness, os.tmpdir()]);
  const doc = {
    schema: 'comprehend-01-run/v1', mode: live ? 'live' : 'dry-run (scripted fake model)', modelCalls: runner.kind === 'fake' ? 0 : spawns, bankSha256: bankSha, frameSha256: FRAME_SHA256,
    model: MODEL, caps: CAPS, plannedSessions: PLANNED_SESSIONS, hardCap, isolated: isolation !== undefined, spawns, refused,
    ...(live ? {} : { fakeSpawns: (runner as FakeModelRunner).spawned.length, serverSmoke: smoke, note: 'Fake answers and fake token numbers: this checks the plumbing, the scoring and the ledger, and says nothing about the arms.' }),
    summary,
  };
  fs.writeFileSync(path.join(out, 'summary.json'), `${scrub(JSON.stringify(doc, null, 1))}\n`);
  for (const f of ['ledger.jsonl', 'plan.json']) fs.writeFileSync(path.join(out, f), scrub(fs.readFileSync(path.join(out, f), 'utf8')));
  process.stdout.write(`${JSON.stringify({ mode: doc.mode, spawns, refused, accuracy: summary.accuracy, accuracyNonGw: summary.accuracyNonGw, tokenRatio: summary.tokenRatioFGoverF, invalid: summary.invalid, capHits: summary.capHits, formatFailures: summary.formatFailures, diagnosis: summary.diagnosis, smoke }, null, 1)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('run.ts')) main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`); process.exitCode = 1; });
