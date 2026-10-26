/**
 * v1.5 instrument (Stage 0, 2026-10-26): promoted from `experiments/edit-gate/hub.ts`; the logic is unchanged and the
 * prototype stays in place as the record of the exploratory runs.
 *
 * Edit-gate hub (v1.5-exp, exploratory): the root-side process of the note's §4. It listens on a Unix socket; the
 * generator's hook command (`gate-relay.cjs`) sends each hook's stdin JSON there. For the current cell only, the hub
 * runs `check_consistency` (DETECT-02, imported read-only, warm in this process) on the whole work tree with the
 * puzzle spec, keeps only findings that involve a file changed since the seed, de-duplicates them per session
 * (`gate.ts`) and replies with the hook JSON. It never echoes a spec path or spec text, refuses a `file_path` outside
 * the work tree (symlinks resolved first), drops `transcript_path`, and fails open (empty reply, logged) on any error.
 *
 * With the `layers` option (PUZZLE-04) the hub also runs the frozen `check_diff` layer rules FF-S01–S03 on the changed
 * source files against a copy of the seed taken when the cell opens (`layers.ts`); their findings join the same
 * de-duplication, message and Stop hook.
 *
 * One JSON line per hook event goes to `<logDir>/<cell>.gate.jsonl` (root-only): the record of the run.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { checkConsistency } from '../consistency.js';
import { checkLayers } from './layers.js';
import { GATED_TOOLS, GateState, editMessage, insideTree, keyOf, parseHookEvent, postToolUseReply, stopMessage, stopReply } from './gate.js';

export interface GateCell {
  readonly id: string;
  readonly turn: string;
  /** Root-only puzzle spec (`/srv/o/specs/tN.yaml` in a run). */
  readonly spec: string;
  readonly project: string;
  /** Optional: the tree whose files count as unchanged (default: the work tree as it is when the cell opens). */
  readonly baseline?: string;
}

/** A tree's files (no `node_modules`) and their sha256, POSIX relative paths. */
export function treeHashes(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (rel === '' && e.name === 'node_modules') continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.set(r, createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex'));
    }
  };
  walk('');
  return out;
}

/**
 * Symlinks in the tree (other than the skeleton's root `node_modules`) that resolve outside it. The checker runs as
 * root and would follow them, so a tree that has one is not checked: its findings could quote root-only files.
 */
export function escapingLinks(dir: string): string[] {
  const root = fs.realpathSync(dir);
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isSymbolicLink()) {
        if (r === 'node_modules') continue;
        let target: string | null = null;
        try {
          target = fs.realpathSync(path.join(dir, r));
        } catch {
          continue; // dangling: nothing to read
        }
        const x = path.relative(root, target);
        if (x.startsWith('..') || path.isAbsolute(x)) out.push(r);
      } else if (e.isDirectory()) walk(r);
    }
  };
  walk('');
  return out.sort();
}

export function changedSince(seed: ReadonlyMap<string, string>, now: ReadonlyMap<string, string>): string[] {
  const out = [...now].filter(([f, h]) => seed.get(f) !== h).map(([f]) => f);
  for (const f of seed.keys()) if (!now.has(f)) out.push(f);
  return out.sort();
}

export interface GateLogLine {
  readonly at: string;
  readonly cell: string;
  readonly turn: string;
  readonly event: string;
  readonly tool: string | null;
  readonly file: string | null;
  readonly refused: string | null;
  readonly ms: number;
  readonly checkMs: number | null;
  readonly changedFiles: number | null;
  readonly findings: number | null;
  readonly newKeys: readonly string[];
  readonly resolvedKeys: readonly string[];
  readonly openKeys: readonly string[];
  readonly replied: boolean;
  readonly stopBlock: boolean;
  readonly failOpen: boolean;
  readonly error: string | null;
  /** Gaming flag: the agent's tree holds DETECT-02's allowance overlay, which can turn findings into `allowed`. */
  readonly allowOverlay: boolean;
  /** `layers` only: blocking FF-S01–S03 findings in this event's check, the advisory ones dropped, and the time. */
  readonly layerFindings?: number | null;
  readonly layerAdvisory?: number | null;
  readonly layerMs?: number | null;
  /** `layers` only: the layer check failed; its findings are dropped, the consistency findings still count. */
  readonly layerError?: string | null;
}

interface Session { readonly cell: GateCell; readonly seed: Map<string, string>; readonly state: GateState; readonly scratch: string; readonly seedCopy: string }

export interface GateHubOptions {
  /** Also run the frozen layer rules FF-S01–S03 (`layers.ts`). Off by default (the build's gate). */
  readonly layers?: boolean;
}

export class GateHub {
  private server: net.Server | null = null;
  private session: Session | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly socket: string,
    private readonly logDir: string,
    /** Optional seam for tests: replaces the check. */
    private readonly check: typeof checkConsistency = checkConsistency,
    private readonly options: GateHubOptions = {},
  ) {}

  /** Opens a session on a cell; the seed is the tree as it is now. Warms the checker once (not logged). */
  async setCell(cell: GateCell): Promise<void> {
    const scratch = path.join(this.logDir, 'scratch', cell.id);
    fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
    const seedCopy = path.join(scratch, 'seed');
    fs.rmSync(seedCopy, { recursive: true, force: true });
    if (this.options.layers === true) fs.cpSync(cell.project, seedCopy, { recursive: true, filter: (src) => path.relative(cell.project, src).split(path.sep)[0] !== 'node_modules' });
    this.session = { cell, seed: treeHashes(cell.baseline ?? cell.project), state: new GateState(), scratch, seedCopy };
    await this.check({ root: cell.project, spec: cell.spec, scratch }).catch(() => undefined);
    // Warm the frozen handler once: every seed file diffed against nothing (not logged, findings dropped).
    if (this.options.layers === true) await checkLayers({ root: cell.project, spec: cell.spec, seedDir: path.join(scratch, 'none'), changed: [...this.session.seed.keys()] }).catch(() => undefined);
  }

  setTurn(turn: string): void {
    if (this.session !== null) this.session = { ...this.session, cell: { ...this.session.cell, turn } };
  }

  clear(): void {
    this.session = null;
  }

  async start(): Promise<void> {
    fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(this.socket), { recursive: true });
    fs.chmodSync(path.dirname(this.socket), 0o755);
    fs.rmSync(this.socket, { force: true });
    // Half-open: the relay ends its side after sending the event, and still reads the reply.
    this.server = net.createServer({ allowHalfOpen: true }, (conn) => this.connect(conn));
    await new Promise<void>((resolve) => this.server?.listen(this.socket, resolve));
    fs.chmodSync(this.socket, 0o666);
  }

  async stop(): Promise<void> {
    this.clear();
    await new Promise<void>((resolve) => (this.server === null ? resolve() : this.server.close(() => resolve())));
    fs.rmSync(this.socket, { force: true });
  }

  logFile(cell: string): string {
    return path.join(this.logDir, `${cell}.gate.jsonl`);
  }

  private connect(conn: net.Socket): void {
    const chunks: Buffer[] = [];
    let size = 0;
    conn.on('data', (c: Buffer) => {
      size += c.length;
      if (size <= 4 * 1024 * 1024) chunks.push(c);
    });
    conn.on('error', () => conn.destroy());
    conn.on('end', () => {
      // One event at a time, in arrival order: the de-duplication state is per session.
      this.queue = this.queue.then(async () => {
        const reply = await this.handle(Buffer.concat(chunks).toString('utf8'));
        conn.end(reply);
      }).catch(() => conn.end(''));
    });
  }

  /** One hook event → the hook's stdout. Exposed for the unit tests. */
  async handle(raw: string): Promise<string> {
    const t0 = performance.now();
    const s = this.session;
    const ev = parseHookEvent(raw);
    const base = { at: new Date().toISOString(), tool: ev?.tool ?? null, file: null as string | null, refused: null as string | null, checkMs: null as number | null, changedFiles: null as number | null, findings: null as number | null, newKeys: [] as string[], resolvedKeys: [] as string[], openKeys: [] as string[], stopBlock: false, failOpen: false, error: null as string | null, allowOverlay: false };
    if (s === null) return '';
    const log = (line: Omit<GateLogLine, 'cell' | 'turn' | 'ms' | 'event' | 'replied'>, event: string, reply: string): string => {
      const full: GateLogLine = { ...line, cell: s.cell.id, turn: s.cell.turn, event, ms: Math.round(performance.now() - t0), replied: reply !== '' };
      fs.appendFileSync(this.logFile(s.cell.id), `${JSON.stringify(full)}\n`);
      return reply;
    };
    if (ev === null) return log({ ...base, refused: 'unparsable hook input' }, 'invalid', '');
    if (ev.event === 'other') return log({ ...base, refused: 'not a gated hook event' }, 'other', '');
    let file: string | null = null;
    if (ev.event === 'PostToolUse') {
      if (ev.tool === null || !GATED_TOOLS.includes(ev.tool)) return log({ ...base, refused: 'not a gated tool' }, ev.event, '');
      if (ev.filePath === null) return log({ ...base, refused: 'no file_path' }, ev.event, '');
      file = insideTree(s.cell.project, ev.filePath);
      if (file === null) return log({ ...base, refused: 'outside the work tree' }, ev.event, '');
    }
    try {
      const links = escapingLinks(s.cell.project);
      if (links.length > 0) return log({ ...base, file, refused: `symlink out of the work tree: ${links.slice(0, 3).join(', ')}` }, ev.event, '');
      const allowOverlay = fs.existsSync(path.join(s.cell.project, 'detect02.allow.yaml')) && !s.seed.has('detect02.allow.yaml');
      const changed = changedSince(s.seed, treeHashes(s.cell.project));
      const t1 = performance.now();
      const res = changed.length === 0 ? null : await this.check({ root: s.cell.project, spec: s.cell.spec, files: changed, scratch: s.scratch });
      // A layer-check error (for example a spec the frozen loader rejects) is logged and drops only the layer findings.
      let layerError: string | null = null;
      const lay = this.options.layers === true && changed.length > 0
        ? await checkLayers({ root: s.cell.project, spec: s.cell.spec, seedDir: s.seedCopy, changed }).catch((e: unknown) => {
          layerError = (e instanceof Error ? e.message : String(e)).slice(0, 300);
          return null;
        })
        : null;
      const checkMs = res === null ? 0 : Math.round(performance.now() - t1);
      const keyed = [...(res === null ? [] : res.findings.map((f) => keyOf(f, res.aggregateRoots))), ...(lay?.findings ?? [])];
      const d = s.state.update(keyed);
      const layerFields = this.options.layers === true ? { layerFindings: lay?.findings.length ?? 0, layerAdvisory: lay?.advisory ?? 0, layerMs: lay?.ms ?? 0, layerError } : {};
      const common = { ...base, file, checkMs, changedFiles: changed.length, findings: keyed.length, newKeys: d.fresh.map((f) => f.key), resolvedKeys: d.resolved.map((f) => f.key), openKeys: d.open.map((f) => f.key), allowOverlay, ...layerFields };
      if (ev.event === 'PostToolUse') return log(common, ev.event, postToolUseReply(editMessage(d)));
      const block = d.open.length > 0 && !ev.stopHookActive && s.state.claimStop(s.cell.turn);
      return log({ ...common, stopBlock: block }, ev.event, block ? stopReply(stopMessage(d.open)) : '');
    } catch (e) {
      return log({ ...base, file, failOpen: true, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, ev.event, '');
    }
  }
}
