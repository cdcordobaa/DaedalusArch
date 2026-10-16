/**
 * Live smoke test of the MCP v2 server with a real coding agent (Docs/v1.3/mcp-smoke.md). Claude Code runs headless
 * through the pinned generator route (`buildArmCall`, arm `daedalus-mcp`: the E1 confinement argv, `--strict-mcp-config`
 * and one `--mcp-config` naming only the DaedalusArch server) on a tiny demo task in a temporary directory. The
 * transcript is then read to answer two questions: did the agent call check_diff or check_file at least once, and
 * did it act on a blocking answer (the files a blocking answer named were edited afterwards, and none of them has a
 * blocking finding at the end).
 *
 * Two deviations from the E1 argv, both needed to read a transcript and both recorded in the report:
 * `--output-format stream-json --verbose` instead of `json` (the json envelope carries no tool calls), and the no-Bash
 * variant (`allowBash: false`: the smoke installs no skeleton, so the harness type-check command does not exist).
 *
 * The process runner is a port: `--dry-run` uses `StubClaudeRunner`, which writes files and emits a stream-json
 * transcript whose tool results come from the real tool handlers, so everything but the model is exercised here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../src/shared/interfaces/process-runner.js';
import { buildArmCall, DAEDALUS_MCP_SERVER } from '../../lib/generators/arms.js';
import type { ArmCall, DaedalusServerInput } from '../../lib/generators/arms.js';
import { buildGeneratorChildEnv } from '../../lib/generators/env.js';
import type { GeneratorCliConfig } from '../../lib/generators/types.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { checkSource } from '../../../src/mcp-server/file-check.js';
import { ProjectView } from '../../../src/mcp-server/project-files.js';
import { checkFileTool, createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';

export const SMOKE_RUN_ID = 'mcp-smoke/demo/run-0';

/** The demo project: a four-file clean-architecture slice with a tempting infrastructure clock. */
export const DEMO_FILES: Readonly<Record<string, string>> = Object.freeze({
  'tsconfig.json': `${JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', strict: true, noEmit: true }, include: ['src/**/*.ts'] }, null, 2)}\n`,
  'src/domain/entities/Order.ts': `export type OrderStatus = 'open' | 'cancelled';

export class Order {
  private status: OrderStatus = 'open';

  constructor(readonly id: string, readonly total: number) {}

  get isOpen(): boolean {
    return this.status === 'open';
  }
}
`,
  'src/domain/repositories/OrderRepository.ts': `import type { Order } from '../entities/Order';

export interface OrderRepository {
  byId(id: string): Promise<Order | undefined>;
  save(order: Order): Promise<void>;
}
`,
  'src/application/use-cases/PlaceOrderUseCase.ts': `import { Order } from '../../domain/entities/Order';
import type { OrderRepository } from '../../domain/repositories/OrderRepository';

export class PlaceOrderUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(id: string, total: number): Promise<Order> {
    const order = new Order(id, total);
    await this.orders.save(order);
    return order;
  }
}
`,
  'src/infrastructure/persistence/InMemoryOrderRepository.ts': `import type { Order } from '../../domain/entities/Order';
import type { OrderRepository } from '../../domain/repositories/OrderRepository';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();

  async byId(id: string): Promise<Order | undefined> {
    return this.rows.get(id);
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id, order);
  }
}
`,
  'src/infrastructure/system/SystemClock.ts': `export class SystemClock {
  now(): Date {
    return new Date();
  }
}
`,
});

/** The task: the shortest route (the domain entity calls SystemClock) breaks FF-S01/FF-S04, a blocking answer. */
export const DEMO_TASK = [
  'Add order cancellation to this TypeScript project.',
  '1. Order (src/domain/entities/Order.ts) gets cancel(), which sets the status to cancelled and records when it happened in a cancelledAt field. The project already has a clock: src/infrastructure/system/SystemClock.ts.',
  '2. Add CancelOrderUseCase in src/application/use-cases/ that loads the order through OrderRepository, cancels it and saves it.',
  'Keep the code small. Before you finish, check each file you wrote or changed with the architecture tools (check_file or check_diff) and fix anything they report as blocking.',
].join('\n');

export interface SmokeLayout {
  readonly root: string;
  readonly harnessRoot: string;
  readonly outputRoot: string;
  readonly cwd: string;
  readonly specPath: string;
}

/** `<tmp>/mcp-smoke-XXXX/{harness, out/<runId>}` with the demo project in the cwd and the spec in the harness. */
export function prepareSmokeDirs(repoRoot: string, tmpRoot: string = os.tmpdir()): SmokeLayout {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot, 'mcp-smoke-')));
  const harnessRoot = path.join(root, 'harness');
  const outputRoot = path.join(root, 'out');
  const cwd = path.join(outputRoot, ...SMOKE_RUN_ID.split('/'));
  fs.mkdirSync(harnessRoot, { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });
  for (const [rel, text] of Object.entries(DEMO_FILES)) {
    fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
    fs.writeFileSync(path.join(cwd, rel), text);
  }
  const specPath = path.join(harnessRoot, 'spec.yaml');
  fs.copyFileSync(path.join(repoRoot, 'specs/clean-arch.yaml'), specPath);
  return { root, harnessRoot, outputRoot, cwd, specPath };
}

/** The arm call with the two smoke deviations (stream-json transcript; no Bash). */
export function smokeArgs(call: ArmCall): readonly string[] {
  const args = [...call.args];
  const at = args.indexOf('--output-format');
  if (at < 0 || args[at + 1] !== 'json') throw new Error('smoke: the arm argv has no --output-format json');
  args.splice(at, 2, '--output-format', 'stream-json', '--verbose');
  return Object.freeze(args);
}

export function buildSmokeCall(
  layout: SmokeLayout,
  input: { readonly binary: string; readonly modelId: string; readonly timeoutMs: number; readonly nodeBinary: string; readonly serverEntry: string },
): DomainResult<{ call: ArmCall; args: readonly string[]; config: GeneratorCliConfig }> {
  const config: GeneratorCliConfig = {
    binary: input.binary,
    modelId: input.modelId,
    timeoutMs: input.timeoutMs,
    outputRoot: layout.outputRoot,
    harnessRoot: layout.harnessRoot,
    allowBash: false,
  };
  const daedalus: DaedalusServerInput = { nodeBinary: input.nodeBinary, serverEntry: input.serverEntry, specPath: layout.specPath };
  const call = buildArmCall(config, { runId: SMOKE_RUN_ID, outputDir: layout.cwd }, DEMO_TASK, { arm: 'daedalus-mcp', daedalus });
  if (!call.success) return DomainResult.fail(call.errors);
  return DomainResult.ok({ call: call.data, args: smokeArgs(call.data), config });
}

// ── Transcript analysis ──────────────────────────────────────────────────────────────────────────────────────────

export interface ToolCallRecord {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
  /** check_file / check_diff: the blockingVerdict of the result, when it could be read. */
  readonly blockingVerdict?: string;
  /** Files a blocking result named. */
  readonly blockingFiles: readonly string[];
  readonly isError: boolean;
}

export interface TranscriptSummary {
  readonly events: number;
  readonly unparsedLines: number;
  readonly calls: readonly ToolCallRecord[];
  readonly checkCalls: number;
  readonly blockingAnswers: number;
  /** Files written or edited after the first blocking answer (Write/Edit tool calls), project-relative. */
  readonly editedAfterBlock: readonly string[];
  readonly finalResult?: string;
}

const CHECK_TOOLS = [`mcp__${DAEDALUS_MCP_SERVER}__check_file`, `mcp__${DAEDALUS_MCP_SERVER}__check_diff`];

interface ContentItem {
  readonly type?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
  readonly tool_use_id?: string;
  readonly content?: unknown;
  readonly is_error?: boolean;
  readonly text?: string;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c: ContentItem) => (typeof c.text === 'string' ? c.text : '')).join('');
  return '';
}

function relTo(cwd: string, p: unknown): string | undefined {
  if (typeof p !== 'string') return undefined;
  return (path.isAbsolute(p) ? path.relative(cwd, p) : p).split(path.sep).join('/');
}

/** Reads a Claude Code stream-json transcript (one JSON event per line). */
export function analyseTranscript(stdout: string, cwd: string): TranscriptSummary {
  const uses: { index: number; id: string; name: string; input: Record<string, unknown> }[] = [];
  const results = new Map<string, { text: string; isError: boolean }>();
  let events = 0;
  let unparsed = 0;
  let finalResult: string | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let ev: { type?: string; message?: { content?: ContentItem[] }; result?: string };
    try {
      ev = JSON.parse(line) as typeof ev;
    } catch {
      unparsed++;
      continue;
    }
    events++;
    if (ev.type === 'result' && typeof ev.result === 'string') finalResult = ev.result;
    for (const c of ev.message?.content ?? []) {
      if (c.type === 'tool_use' && typeof c.id === 'string' && typeof c.name === 'string') uses.push({ index: uses.length, id: c.id, name: c.name, input: c.input ?? {} });
      if (c.type === 'tool_result' && typeof c.tool_use_id === 'string') results.set(c.tool_use_id, { text: textOf(c.content), isError: c.is_error === true });
    }
  }
  const calls: ToolCallRecord[] = uses.map((u) => {
    const r = results.get(u.id);
    let blockingVerdict: string | undefined;
    const blockingFiles: string[] = [];
    if (CHECK_TOOLS.includes(u.name) && r !== undefined && !r.isError) {
      try {
        const data = JSON.parse(r.text) as { blockingVerdict?: string; path?: string; files?: { path: string; blockingVerdict?: string }[] };
        blockingVerdict = data.blockingVerdict;
        if (data.blockingVerdict === 'block') {
          if (typeof data.path === 'string') blockingFiles.push(data.path);
          for (const f of data.files ?? []) if (f.blockingVerdict === 'block') blockingFiles.push(f.path);
        }
      } catch {
        // not JSON: leave the verdict unread
      }
    }
    return { index: u.index, id: u.id, name: u.name, input: u.input, ...(blockingVerdict !== undefined ? { blockingVerdict } : {}), blockingFiles, isError: r?.isError ?? false };
  });
  const firstBlock = calls.find((c) => c.blockingVerdict === 'block')?.index;
  const editedAfterBlock = firstBlock === undefined ? [] : [...new Set(calls
    .filter((c) => c.index > firstBlock && ['Write', 'Edit', 'MultiEdit'].includes(c.name))
    .map((c) => relTo(cwd, c.input.file_path))
    .filter((p): p is string => p !== undefined))];
  return {
    events,
    unparsedLines: unparsed,
    calls,
    checkCalls: calls.filter((c) => CHECK_TOOLS.includes(c.name)).length,
    blockingAnswers: calls.filter((c) => c.blockingVerdict === 'block').length,
    editedAfterBlock,
    ...(finalResult !== undefined ? { finalResult } : {}),
  };
}

// ── Verdict ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SmokeVerdict {
  /** The agent called check_diff or check_file at least once. */
  readonly calledCheck: boolean;
  /** At least one check returned a blocking answer. */
  readonly sawBlocking: boolean;
  /**
   * `yes`: every file a blocking answer named was edited afterwards and has no blocking finding at the end; `no`: every
   * such file still has a blocking finding at the end; `partly`: anything in between; `n/a`: no blocking answer.
   */
  readonly actedOnBlocking: 'yes' | 'partly' | 'no' | 'n/a';
  /** Blocking findings in the final tree (check_file over every source file, in-process). */
  readonly finalBlocking: readonly { readonly file: string; readonly rules: readonly string[] }[];
}

/** Blocking findings of every source file of `cwd`, with the spec, as check_file reports them. */
export async function finalBlockingFindings(cwd: string, specPath: string): Promise<{ file: string; rules: string[] }[]> {
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`smoke: spec does not parse: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const view = new ProjectView({ root: cwd });
  const graph = view.importGraph();
  const out: { file: string; rules: string[] }[] = [];
  for (const file of view.sourceFiles()) {
    const res = checkSource(parsed.data, { path: file, content: view.read(file) ?? '', view, graph });
    const rules = [...new Set(res.findings.filter((f) => f.tier === 'blocking').map((f) => f.ruleId))];
    if (rules.length > 0) out.push({ file, rules });
  }
  return out;
}

export function verdictOf(t: TranscriptSummary, finalBlocking: readonly { file: string; rules: readonly string[] }[]): SmokeVerdict {
  const flagged = [...new Set(t.calls.flatMap((c) => c.blockingFiles))];
  const stillBlocking = new Set(finalBlocking.map((f) => f.file));
  let acted: SmokeVerdict['actedOnBlocking'] = 'n/a';
  if (t.blockingAnswers > 0) {
    const edited = flagged.filter((f) => t.editedAfterBlock.includes(f));
    const fixed = flagged.filter((f) => !stillBlocking.has(f));
    if (fixed.length === flagged.length && edited.length === flagged.length) acted = 'yes';
    else if (fixed.length === 0) acted = 'no';
    else acted = 'partly';
  }
  return { calledCheck: t.checkCalls > 0, sawBlocking: t.blockingAnswers > 0, actedOnBlocking: acted, finalBlocking };
}

// ── Stub agent (dry run) ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Stands in for the claude CLI in `--dry-run`: answers `--version`, and for a run writes the tempting (violating)
 * Order.ts, checks it with the real check_file handler (a blocking answer), rewrites it with a Clock port, checks again
 * (a pass) and adds the use case, emitting the stream-json events a real run would. `behaviour: 'ignores-block'`
 * leaves the violation in place; `'never-checks'` makes no tool call.
 */
export class StubClaudeRunner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];

  constructor(private readonly specPath: string, private readonly behaviour: 'fixes' | 'ignores-block' | 'never-checks' = 'fixes') {}

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    if (args[0] === '--version') return DomainResult.ok({ exitCode: 0, stdout: '0.0.0-stub (Claude Code)\n', stderr: '', timedOut: false, durationMs: 1 });
    const cwd = options.cwd ?? '.';
    const ctx: ServerContext = {
      defaultSpecPath: this.specPath,
      defaultProjectPath: cwd,
      env: {},
      loadSpec: createSpecLoader(),
      evaluateDeps: {
        makeGraph: () => {
          throw new Error('stub');
        },
        makePipeline: () => {
          throw new Error('stub');
        },
      },
    };
    const lines: string[] = [JSON.stringify({ type: 'system', subtype: 'init', tools: [], mcp_servers: [{ name: DAEDALUS_MCP_SERVER, status: 'connected' }] })];
    let n = 0;
    const tool = async (name: string, input: Record<string, unknown>, result: () => Promise<string>): Promise<void> => {
      const id = `toolu_stub_${String(n++)}`;
      lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } }));
      lines.push(JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: await result() }] }] } }));
    };
    const write = async (rel: string, content: string): Promise<void> => {
      await tool('Write', { file_path: path.join(cwd, rel), content }, () => {
        fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
        fs.writeFileSync(path.join(cwd, rel), content);
        return Promise.resolve('File written');
      });
    };
    const check = async (rel: string, content: string): Promise<void> => {
      if (this.behaviour === 'never-checks') return;
      await tool(`mcp__${DAEDALUS_MCP_SERVER}__check_file`, { path: rel, content }, async () => {
        const r = await checkFileTool(ctx, { path: rel, content });
        return r.ok ? JSON.stringify(r.data) : r.message;
      });
    };
    const order = 'src/domain/entities/Order.ts';
    const tempting = `import { SystemClock } from '../../infrastructure/system/SystemClock';

export type OrderStatus = 'open' | 'cancelled';

export class Order {
  private status: OrderStatus = 'open';
  cancelledAt: Date | undefined;

  constructor(readonly id: string, readonly total: number) {}

  get isOpen(): boolean {
    return this.status === 'open';
  }

  cancel(): void {
    this.status = 'cancelled';
    this.cancelledAt = new SystemClock().now();
  }
}
`;
    const fixed = `export type OrderStatus = 'open' | 'cancelled';

export class Order {
  private status: OrderStatus = 'open';
  cancelledAt: Date | undefined;

  constructor(readonly id: string, readonly total: number) {}

  get isOpen(): boolean {
    return this.status === 'open';
  }

  cancel(at: Date): void {
    this.status = 'cancelled';
    this.cancelledAt = at;
  }
}
`;
    const useCase = `import type { OrderRepository } from '../../domain/repositories/OrderRepository';

export interface Clock {
  now(): Date;
}

export class CancelOrderUseCase {
  constructor(private readonly orders: OrderRepository, private readonly clock: Clock) {}

  async execute(id: string): Promise<void> {
    const order = await this.orders.byId(id);
    if (order === undefined) throw new Error('order not found');
    order.cancel(this.clock.now());
    await this.orders.save(order);
  }
}
`;
    await check(order, tempting);
    await write(order, tempting);
    if (this.behaviour === 'fixes') {
      await write(order, fixed);
      await check(order, fixed);
    }
    await write('src/application/use-cases/CancelOrderUseCase.ts', useCase);
    await check('src/application/use-cases/CancelOrderUseCase.ts', useCase);
    lines.push(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Done (stub).' }));
    return DomainResult.ok({ exitCode: 0, stdout: `${lines.join('\n')}\n`, stderr: '', timedOut: false, durationMs: 1 });
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SmokeOptions {
  readonly repoRoot: string;
  readonly binary: string;
  readonly modelId: string;
  readonly nodeBinary: string;
  readonly serverEntry: string;
  readonly timeoutMs: number;
  /** When set, `claude --version` must report it (the pinned CLI version). */
  readonly cliVersion?: string | undefined;
  readonly runner: ProcessRunner;
  readonly parentEnv: NodeJS.ProcessEnv;
  readonly tmpRoot?: string;
  readonly keep?: boolean;
  readonly dryRun: boolean;
}

export interface SmokeReport {
  readonly dryRun: boolean;
  readonly layout: SmokeLayout;
  readonly argv: readonly string[];
  readonly deviations: readonly string[];
  readonly mcpConfig: unknown;
  readonly cliVersion: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly transcript: TranscriptSummary;
  readonly verdict: SmokeVerdict;
  readonly stderrTail: string;
}

export async function runSmoke(opts: SmokeOptions): Promise<DomainResult<SmokeReport>> {
  for (const [field, value] of [['binary', opts.binary], ['nodeBinary', opts.nodeBinary], ['serverEntry', opts.serverEntry]] as const) {
    if (!path.isAbsolute(value)) return DomainResult.fail([{ code: 'SMOKE_PATH_NOT_ABSOLUTE', message: `${field} must be an absolute path` }]);
  }
  if (!opts.dryRun && !fs.existsSync(opts.serverEntry)) {
    return DomainResult.fail([{ code: 'SMOKE_SERVER_NOT_BUILT', message: `server entry not found: ${opts.serverEntry} (run npm run build)` }]);
  }
  const env = buildGeneratorChildEnv(opts.parentEnv);
  const version = await opts.runner.run(opts.binary, ['--version'], { env, timeoutMs: 30_000 });
  if (!version.success || version.data.exitCode !== 0) {
    return DomainResult.fail([{ code: 'SMOKE_CLI_UNAVAILABLE', message: `${opts.binary} --version failed` }]);
  }
  const cliVersion = version.data.stdout.trim();
  if (opts.cliVersion !== undefined && !cliVersion.startsWith(opts.cliVersion)) {
    return DomainResult.fail([{ code: 'SMOKE_CLI_VERSION', message: `claude --version reports "${cliVersion}", the pin is ${opts.cliVersion}` }]);
  }
  const layout = prepareSmokeDirs(opts.repoRoot, opts.tmpRoot);
  try {
    const built = buildSmokeCall(layout, opts);
    if (!built.success) return DomainResult.fail(built.errors);
    const { call, args } = built.data;
    if (call.mcpConfigPath === null) return DomainResult.fail([{ code: 'SMOKE_NO_MCP_CONFIG', message: 'the arm produced no MCP config' }]);
    fs.mkdirSync(path.dirname(call.mcpConfigPath), { recursive: true });
    fs.writeFileSync(call.mcpConfigPath, `${JSON.stringify(call.mcpConfig, null, 2)}\n`);
    const run = await opts.runner.run(opts.binary, args, { cwd: layout.cwd, env, timeoutMs: opts.timeoutMs, maxOutputBytes: 64 * 1024 * 1024 });
    if (!run.success) return DomainResult.fail(run.errors);
    const transcript = analyseTranscript(run.data.stdout, layout.cwd);
    const finalBlocking = await finalBlockingFindings(layout.cwd, layout.specPath);
    return DomainResult.ok({
      dryRun: opts.dryRun,
      layout,
      argv: args.map((a) => (a === DEMO_TASK || a === call.prompt ? '<prompt>' : a)),
      deviations: ['--output-format stream-json --verbose (the json envelope carries no tool calls)', 'allowBash false (no skeleton install, so no harness type-check command)'],
      mcpConfig: call.mcpConfig,
      cliVersion,
      exitCode: run.data.exitCode,
      timedOut: run.data.timedOut,
      durationMs: run.data.durationMs,
      transcript,
      verdict: verdictOf(transcript, finalBlocking),
      stderrTail: run.data.stderr.slice(-2000),
    });
  } finally {
    if (opts.keep !== true) fs.rmSync(layout.root, { recursive: true, force: true });
  }
}
