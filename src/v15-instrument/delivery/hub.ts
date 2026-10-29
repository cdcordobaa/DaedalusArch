/**
 * v1.5 combined delivery hub (design note `ops/notes/v15-combined-delivery-design-2026-10-26.md` §1.2, §4, §5.3; step 2).
 * One root-side process per session with two Unix sockets and one finding ledger:
 * - the **hook socket** takes the edit gate's hook events (`../edit-gate/gate-relay.cjs`), as the PUZZLE-04 hub did;
 * - the **MCP socket** takes the generator's MCP relay (`experiments/puzzle-04/mcp-relay.cjs`). Each connection gets
 *   an in-process server: the frozen DaedalusArch tools (imported read-only) plus a ledger-aware `check_consistency`.
 *
 * Both channels key their findings with the gate's key function and number them in one ledger (`ledger.ts`), so a
 * finding has one identity whichever channel shows it first. Push withholds keys already shown; pull answers in full
 * and marks seen keys `already reported`. A check on a tree the hub has just checked comes from the tree-digest cache,
 * so both channels give the same answer on the same tree.
 *
 * Confinement is the PUZZLE-04 hub's: the spec and logs stay root-only, hook events whose file or cwd is outside the
 * work tree, or whose session id is not the cell's, get no reply; MCP calls go through the frozen `confineArgs`. Every
 * error fails open (empty reply, logged). Logs (root-only, one line per event, one shared `seq`):
 * `<cell>.push.jsonl`, `<cell>.calls.jsonl`, and `<cell>.ledger.json` when the cell closes.
 *
 * 2026-10-29 (instrument v1.5.1, `../rule-set.ts`): both channels deliver exactly the rules the scorer runs for the
 * session's style (admitted + exploratory rows of the one rule list): the v1.5 Cypher rules through the hub's check
 * (push: after every gated edit, the findings in changed files; pull: `check_consistency`, which now covers the whole
 * delivered set) and the frozen file rules of the style through the frozen `check_diff` against the seed (push and
 * `check_consistency`; the frozen `check_file` / `check_diff` answers are numbered for the same rules). The style is
 * the cell's `style`, else the spec's `architecture.style`; a style no study scores gets no rule.
 * `tests/unit/v15-instrument/delivery-rule-set.test.ts` holds push == pull == scored.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildContext, parseArgs } from '../../mcp-server/context.js';
import { createServer } from '../../mcp-server/server.js';
import { confineArgs } from '../../mcp-server/confine.js';
import type { FileViolation } from '../../mcp-server/types.js';
import { checkConsistency, type ConsistencyResult } from '../consistency.js';
import { GATED_TOOLS, insideTree, keyOf, parseHookEvent, postToolUseReply, stopReply, type KeyedFinding } from '../edit-gate/gate.js';
import { changedSince, escapingLinks, treeHashes } from '../edit-gate/hub.js';
import { checkLayers, LAYER_RULES, toKeyed } from '../edit-gate/layers.js';
import { CHECK_CONSISTENCY, CONSISTENCY_SHAPE } from '../mcp/server.js';
import { preflightSpec } from '../preflight.js';
import { cypherRules, frozenRules, scoredStyle, type Style } from '../rule-set.js';
import { loadSpec } from '../spec.js';
import { FindingLedger, type PullAnnotation, type PullScope } from './ledger.js';
import { pullConsistencyText, pullFrozenHeader, pushMessage, stopText } from './messages.js';

export interface DeliveryCell {
  readonly id: string;
  /** The CLI session id the hook events must carry (null: not checked, for the stub driver). */
  readonly session: string | null;
  readonly step: string;
  readonly turn: string;
  readonly spec: string;
  readonly project: string;
  /** Optional: the tree whose files count as unchanged (default: the work tree when the cell opens). */
  readonly baseline?: string;
  /** Optional: the scored style whose rules are delivered (default: the spec's `architecture.style`). */
  readonly style?: Style;
}

/** The rule ids a cell's channels deliver: the style's scored set from the one rule list, split by kind. */
export interface DeliveredRules { readonly style: Style | null; readonly cypher: readonly string[]; readonly frozen: readonly string[] }

export function deliveredRulesOf(cell: Pick<DeliveryCell, 'spec' | 'project' | 'style'>): DeliveredRules {
  const style = cell.style ?? scoredStyle(loadSpec(cell.project, cell.spec).style);
  return style === null ? { style, cypher: [], frozen: [] } : { style, cypher: cypherRules(style), frozen: frozenRules(style) };
}

/** The hub's `check_consistency` description: the whole delivered set, not only the consistency pair. */
export const HUB_CHECK_DESCRIPTION =
  'Checks the code against the architecture rules of the spec: its layers, its ports and adapters, and its aggregates and bounded contexts, as the spec declares them. These are the same checks that run automatically after each file you create or edit. '
  + 'WHEN: after you change code, and always before you finish a step. '
  + 'Each finding gives file:line, the rule in plain words, why this code breaks it (the files and symbols involved) and a fix; a finding you have already been shown is listed by its number only. status is clean or violations. '
  + 'Fast and deterministic (no model call). Pass `files` (changed files, project-relative) to see only findings in them, or nothing to check the whole project.';

export interface DeliveryHubOptions {
  /**
   * Ignored since instrument v1.5.1: the frozen rules of the style are always delivered on both channels (the field is
   * kept so existing drivers type-check). Before, it switched FF-S01–S03 on for push only.
   */
  readonly layers?: boolean;
  /** Test seams. */
  readonly check?: typeof checkConsistency;
  readonly checkLayers?: typeof checkLayers;
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const digestOf = (h: ReadonlyMap<string, string>): string => sha([...h].sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, x]) => `${f}\0${x}`).join('\n'));

/** One check of a tree state by both rule kinds: the v1.5 result and every keyed finding (v1.5 first, then frozen). */
interface Delivered { readonly res: ConsistencyResult; readonly keyed: readonly KeyedFinding[]; readonly frozenCount: number; readonly frozenError: string | null }

interface Session {
  cell: DeliveryCell;
  readonly seed: Map<string, string>;
  readonly ledger: FindingLedger;
  readonly scratch: string;
  readonly seedCopy: string;
  readonly cache: Map<string, Delivered>;
  readonly rules: DeliveredRules;
  hookEvents: number;
  failOpen: number;
}

export class DeliveryHub {
  private hookServer: net.Server | null = null;
  private mcpServer: net.Server | null = null;
  private s: Session | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly check: typeof checkConsistency;
  private readonly layers: typeof checkLayers;

  constructor(
    private readonly hookSocket: string,
    private readonly mcpSocket: string | null,
    private readonly logDir: string,
    options: DeliveryHubOptions = {},
  ) {
    this.check = options.check ?? checkConsistency;
    this.layers = options.checkLayers ?? checkLayers;
  }

  get ledger(): FindingLedger | null {
    return this.s?.ledger ?? null;
  }

  /** The rule ids the open cell delivers (null when no cell is open). */
  get delivered(): DeliveredRules | null {
    return this.s?.rules ?? null;
  }

  async setCell(cell: DeliveryCell): Promise<void> {
    // Pre-flight: a spec the frozen schema, the frozen DDD binder or the v1.5 reader rejects is refused loudly.
    const pre = await preflightSpec(cell.spec);
    if (!pre.ok) throw new Error(`delivery hub: cell ${cell.id} spec ${cell.spec} fails pre-flight: ${pre.errors.join('; ')}`);
    const scratch = path.join(this.logDir, 'scratch', cell.id);
    fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
    const seedCopy = path.join(scratch, 'seed');
    fs.rmSync(seedCopy, { recursive: true, force: true });
    const base = cell.baseline ?? cell.project;
    fs.cpSync(base, seedCopy, { recursive: true, filter: (src) => path.relative(base, src).split(path.sep)[0] !== 'node_modules' });
    const rules = deliveredRulesOf(cell);
    this.s = { cell, seed: treeHashes(base), ledger: new FindingLedger(), scratch, seedCopy, cache: new Map(), rules, hookEvents: 0, failOpen: 0 };
    await this.check({ root: cell.project, spec: cell.spec, scratch, rules: rules.cypher }).catch(() => undefined); // warm, not logged
  }

  setTurn(step: string, turn: string): void {
    if (this.s !== null) this.s.cell = { ...this.s.cell, step, turn };
  }

  /** Closes the cell and writes its ledger. `finalKeys`: keys present on the final tree, from the scorer, if known. */
  closeCell(finalKeys?: ReadonlySet<string>): void {
    const s = this.s;
    if (s === null) return;
    fs.writeFileSync(path.join(this.logDir, `${s.cell.id}.ledger.json`), `${JSON.stringify({ cell: s.cell.id, hookEvents: s.hookEvents, failOpen: s.failOpen, rows: s.ledger.table(finalKeys) }, null, 2)}\n`);
    this.s = null;
  }

  async start(): Promise<void> {
    fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
    this.hookServer = await this.listen(this.hookSocket, (c) => this.hookConnect(c), true);
    if (this.mcpSocket !== null) this.mcpServer = await this.listen(this.mcpSocket, (c) => this.mcpConnect(c), false);
  }

  async stop(): Promise<void> {
    this.closeCell();
    for (const [srv, sock] of [[this.hookServer, this.hookSocket], [this.mcpServer, this.mcpSocket]] as const) {
      await new Promise<void>((resolve) => (srv === null ? resolve() : srv.close(() => resolve())));
      if (sock !== null) fs.rmSync(sock, { force: true });
    }
  }

  private async listen(sock: string, onConn: (c: net.Socket) => void, halfOpen: boolean): Promise<net.Server> {
    fs.mkdirSync(path.dirname(sock), { recursive: true });
    fs.chmodSync(path.dirname(sock), 0o755);
    fs.rmSync(sock, { force: true });
    const srv = net.createServer({ allowHalfOpen: halfOpen }, onConn);
    await new Promise<void>((resolve) => srv.listen(sock, resolve));
    fs.chmodSync(sock, 0o666);
    return srv;
  }

  private log(file: 'push' | 'calls', line: Record<string, unknown>): void {
    const s = this.s;
    if (s === null) return;
    fs.appendFileSync(path.join(this.logDir, `${s.cell.id}.${file}.jsonl`), `${JSON.stringify({ at: new Date().toISOString(), cell: s.cell.id, step: s.cell.step, turn: s.cell.turn, ...line })}\n`);
  }

  /**
   * The check of one tree state by both rule kinds, cached by tree digest and file scope, so push and pull give the
   * same answer on the same tree. v1.5 rules: the hub's check over `files` (null: the whole project). Frozen rules:
   * `check_diff` of the changed files against the seed copy (`files` and changed, when files are given). A frozen-check
   * error drops only its findings (logged), as the layer check did.
   */
  private async deliver(s: Session, hashes: ReadonlyMap<string, string>, files: readonly string[] | null): Promise<Delivered> {
    const k = `${digestOf(hashes)}|${files === null ? '*' : [...files].sort().join(',')}`;
    const hit = s.cache.get(k);
    if (hit !== undefined) return hit;
    const res = await this.check({ root: s.cell.project, spec: s.cell.spec, scratch: s.scratch, rules: s.rules.cypher, ...(files !== null ? { files } : {}) });
    const changed = changedSince(s.seed, hashes).filter((f) => files === null || files.includes(f));
    let frozenError: string | null = null;
    const lay = s.rules.frozen.length > 0 && changed.length > 0
      ? await this.layers({ root: s.cell.project, spec: s.cell.spec, seedDir: s.seedCopy, changed, rules: s.rules.frozen }).catch((e: unknown) => { frozenError = (e instanceof Error ? e.message : String(e)).slice(0, 300); return null; })
      : null;
    const keyed = [...res.findings.map((f) => keyOf(f, res.aggregateRoots)), ...(lay?.findings ?? [])];
    const d: Delivered = { res, keyed, frozenCount: lay?.findings.length ?? 0, frozenError };
    s.cache.set(k, d);
    return d;
  }

  // ── Push ───────────────────────────────────────────────────────────────────────────────────────────────────────

  private hookConnect(conn: net.Socket): void {
    const chunks: Buffer[] = [];
    let size = 0;
    conn.on('data', (c: Buffer) => { size += c.length; if (size <= 4 * 1024 * 1024) chunks.push(c); });
    conn.on('error', () => conn.destroy());
    conn.on('end', () => {
      this.queue = this.queue.then(async () => conn.end(await this.handleHook(Buffer.concat(chunks).toString('utf8')))).catch(() => conn.end(''));
    });
  }

  /** One hook event → the hook's stdout. Exposed for the unit tests. */
  async handleHook(raw: string): Promise<string> {
    const t0 = performance.now();
    const s = this.s;
    if (s === null) return '';
    const seq = s.ledger.tick();
    const ev = parseHookEvent(raw);
    const base = { seq, channel: 'push', tool: ev?.tool ?? null, file: null as string | null, refused: null as string | null };
    const done = (line: Record<string, unknown>, reply: string): string => {
      this.log('push', { ...base, ...line, ms: Math.round(performance.now() - t0), replied: reply !== '' });
      return reply;
    };
    if (ev === null) return done({ event: 'invalid', refused: 'unparsable hook input' }, '');
    if (ev.event === 'other') return done({ event: 'other', refused: 'not a gated hook event' }, '');
    let sessionId: unknown = null;
    try { sessionId = (JSON.parse(raw) as { session_id?: unknown }).session_id ?? null; } catch { /* parsed above */ }
    if (s.cell.session !== null && sessionId !== s.cell.session) return done({ event: ev.event, refused: 'not this cell\'s session' }, '');
    const cwdOk = ev.cwd === null || safeReal(ev.cwd) === safeReal(s.cell.project) || insideTree(s.cell.project, ev.cwd) !== null;
    if (!cwdOk) return done({ event: ev.event, refused: 'cwd outside the work tree' }, '');
    let file: string | null = null;
    if (ev.event === 'PostToolUse') {
      if (ev.tool === null || !GATED_TOOLS.includes(ev.tool)) return done({ event: ev.event, refused: 'not a gated tool' }, '');
      if (ev.filePath === null) return done({ event: ev.event, refused: 'no file_path' }, '');
      file = insideTree(s.cell.project, ev.filePath);
      if (file === null) return done({ event: ev.event, refused: 'outside the work tree' }, '');
      s.hookEvents++;
    }
    try {
      const links = escapingLinks(s.cell.project);
      if (links.length > 0) return done({ event: ev.event, file, refused: `symlink out of the work tree: ${links.slice(0, 3).join(', ')}` }, '');
      const allowOverlay = fs.existsSync(path.join(s.cell.project, 'detect02.allow.yaml')) && !s.seed.has('detect02.allow.yaml');
      const hashes = treeHashes(s.cell.project);
      const changed = changedSince(s.seed, hashes);
      const t1 = performance.now();
      const dv = changed.length === 0 ? null : await this.deliver(s, hashes, changed);
      const keyed = dv?.keyed ?? [];
      const d = s.ledger.push(keyed, seq);
      const common = {
        event: ev.event, file, treeDigest: digestOf(hashes).slice(0, 16), checkMs: Math.round(performance.now() - t1), changedFiles: changed.length, findings: keyed.length,
        pushed: d.fresh.map((f) => f.number), withheld: d.withheld.map((w) => ({ finding: w.number, shownBy: w.shownBy })), resolved: d.resolved.map((f) => f.number), open: d.open.map((f) => f.number),
        allowOverlay, layerFindings: dv?.frozenCount ?? 0, layerError: dv?.frozenError ?? null,
      };
      if (ev.event === 'PostToolUse') return done(common, postToolUseReply(pushMessage(d.fresh, d.resolved)));
      const block = d.open.length > 0 && !ev.stopHookActive && s.ledger.claimStop(s.cell.turn);
      return done({ ...common, stopBlock: block }, block ? stopReply(stopText(d.open)) : '');
    } catch (e) {
      s.failOpen++;
      return done({ event: ev.event, file, failOpen: true, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, '');
    }
  }

  // ── Pull ───────────────────────────────────────────────────────────────────────────────────────────────────────

  private mcpConnect(conn: net.Socket): void {
    const s = this.s;
    if (s === null) { conn.destroy(); return; }
    void this.serveMcp(s, conn).catch(() => conn.destroy());
  }

  /** An in-process MCP server for one connection: the frozen tools plus the ledger-aware `check_consistency`. */
  async serveMcp(s: Session, conn: NodeJS.ReadableStream & NodeJS.WritableStream): Promise<void> {
    const ctx = buildContext(parseArgs(['--spec', s.cell.spec, '--project', s.cell.project, '--engine', 'cypher-interp', '--confine']), {});
    const server = createServer(ctx);
    const scope = { specPath: s.cell.spec, projectPath: s.cell.project, cwd: s.cell.project };
    const register = server.registerTool.bind(server) as unknown as (name: string, config: Record<string, unknown>, h: (args: unknown) => Promise<CallToolResult>) => unknown;
    register(CHECK_CONSISTENCY, {
      title: 'Check aggregate and context consistency boundaries',
      description: HUB_CHECK_DESCRIPTION,
      inputSchema: CONSISTENCY_SHAPE,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => {
      const refusal = confineArgs(scope, args);
      if (refusal !== null) return { isError: true, content: [{ type: 'text', text: refusal }] };
      return this.pullConsistency(s, args);
    });
    const transport = new StdioServerTransport(conn as never, conn as never);
    const pending = new Map<string, { tool: string; args: unknown; t0: number }>();
    const send = transport.send.bind(transport);
    transport.send = async (msg: JSONRPCMessage): Promise<void> => send(this.tapResponse(s, msg, pending));
    await server.connect(transport);
    const onmessage = transport.onmessage;
    transport.onmessage = (msg: JSONRPCMessage): void => {
      const m = msg as { id?: unknown; method?: string; params?: { name?: string; arguments?: unknown } };
      if (m.method === 'tools/call') pending.set(String(m.id), { tool: String(m.params?.name), args: m.params?.arguments ?? {}, t0: performance.now() });
      onmessage?.(msg);
    };
    conn.on('close', () => { void server.close().catch(() => undefined); });
  }

  /** `check_consistency` for a pull: cached check of the whole delivered set, keyed, numbered in the ledger, seen findings shortened. */
  private async pullConsistency(s: Session, args: unknown): Promise<CallToolResult> {
    const a = z.object(CONSISTENCY_SHAPE).parse(args ?? {});
    try {
      const files = a.files?.map((f) => f.replace(/^\.\//, '')) ?? null;
      const { res, keyed } = await this.deliver(s, treeHashes(s.cell.project), files);
      const all = new Set([...s.rules.cypher, ...s.rules.frozen]);
      const notes = s.ledger.pull(keyed, { files, covers: (r) => r.split('+').every((x) => all.has(x)) });
      const status = keyed.length > 0 ? 'violations' : res.status === 'not-applicable' && s.rules.frozen.length === 0 ? 'not-applicable' : 'clean';
      const summary = keyed.length === res.findings.length ? res.summary : `${String(keyed.length)} finding(s) break an architecture rule: fix each before finishing the step.`;
      return {
        content: [{ type: 'text', text: pullConsistencyText({ ...res, summary }, keyed, notes) }],
        structuredContent: { ...res, status, summary, findings: keyed.map(({ key: _key, command: _command, aggregates: _aggregates, ...f }, i) => ({ ...f, finding: notes[i]!.number, delivery: notes[i]!.status })) } as Record<string, unknown>,
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `check_consistency failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}` }] };
    }
  }

  /** Records every tool call, and numbers the layer findings of the frozen check_file / check_diff answers. */
  private tapResponse(s: Session, msg: JSONRPCMessage, pending: Map<string, { tool: string; args: unknown; t0: number }>): JSONRPCMessage {
    const m = msg as { id?: unknown; result?: CallToolResult };
    const req = m.id === undefined ? undefined : pending.get(String(m.id));
    if (req === undefined || m.result === undefined) return msg;
    pending.delete(String(m.id));
    const seq = s.ledger.tick();
    let numbers: { finding: number; status: string }[] = [];
    let result = m.result;
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    if (req.tool === CHECK_CONSISTENCY && Array.isArray(sc?.findings)) {
      numbers = (sc.findings as { finding: number; delivery: string }[]).map((f) => ({ finding: f.finding, status: f.delivery }));
    } else if ((req.tool === 'check_file' || req.tool === 'check_diff') && sc !== undefined && result.isError !== true) {
      const keyed = frozenLayerFindings(req.tool, sc, s.cell.project, s.rules.frozen);
      const scope: PullScope = { files: keyed.files, covers: (r) => s.rules.frozen.includes(r) };
      const notes: PullAnnotation[] = s.ledger.pull(keyed.findings, scope, seq);
      numbers = notes.map((n) => ({ finding: n.number, status: n.status }));
      const header = pullFrozenHeader(keyed.findings, notes);
      if (header !== '') result = { ...result, content: [{ type: 'text', text: header }, ...result.content] };
    }
    const argFiles = (() => { const x = req.args as { files?: unknown; path?: unknown; file?: unknown }; return Array.isArray(x.files) ? x.files.map(String) : typeof x.path === 'string' ? [x.path] : typeof x.file === 'string' ? [x.file] : []; })();
    this.log('calls', { seq, channel: 'pull', tool: req.tool, argFiles, argDigest: sha(JSON.stringify(req.args)).slice(0, 16), isError: result.isError === true, status: (sc?.status as string | undefined) ?? (sc?.verdict as string | undefined) ?? null, ms: Math.round(performance.now() - req.t0), findings: numbers });
    return { ...(msg as object), result } as unknown as JSONRPCMessage;
  }
}

function safeReal(p: string): string | null {
  try { return fs.realpathSync.native(p); } catch { return null; }
}

/** The blocking findings of the given frozen rules (default FF-S01–S03) in a frozen check_file / check_diff answer, keyed as the gate keys them. */
export function frozenLayerFindings(tool: 'check_file' | 'check_diff', sc: Record<string, unknown>, project: string, rules: readonly string[] = LAYER_RULES): { findings: KeyedFinding[]; files: string[] } {
  const rel = (p: string): string => (path.isAbsolute(p) ? path.relative(project, p) : p).split(path.sep).join('/');
  const fileResults = tool === 'check_file' ? [sc as { path?: string; findings?: FileViolation[] }] : ((sc.files as { path?: string; findings?: FileViolation[] }[] | undefined) ?? []);
  const findings: KeyedFinding[] = [];
  const files: string[] = [];
  const seen = new Set<string>();
  for (const fr of fileResults) {
    const file = rel(String(fr.path ?? ''));
    files.push(file);
    for (const v of fr.findings ?? []) {
      if (!rules.includes(v.ruleId) || v.tier !== 'blocking') continue;
      const k = toKeyed({ ...v, file } as FileViolation & { file: string });
      if (!seen.has(k.key)) { seen.add(k.key); findings.push(k); }
    }
  }
  return { findings, files };
}
