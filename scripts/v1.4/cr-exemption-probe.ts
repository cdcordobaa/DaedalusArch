/**
 * Zero-call probe of the composition-root exemption (pre-registration `Docs/v1.4/study2b-preregistration.md` §7 item 9;
 * Fable review 2026-10-20 finding 2 item 3). Entry file: no exports. No model call, no Neo4j, no network.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/cr-exemption-probe.ts --build <frozen MCP build dir> --node-modules <skeleton install>/node_modules
 *     [--out results/v1.4-study2b-prereg/cr-exemption-probe.json]
 *
 * One synthetic Layered project (`src/persistence/repositories.ts`, `src/business/service.ts`) gets one probe file per
 * name in PROBE_FILES, each importing `../persistence/repositories` (a presentation → persistence edge, FF-S03).
 * 1. **What the `mcp@L2` arm is told.** The frozen MCP build (`<build>/node <build>/dist/mcp-server/main.js --spec
 *    <build>/presets/layered.yaml --project <dir> --engine neo4j --confine`, the harness's own launch line) is driven
 *    over stdio JSON-RPC: `check_import` (fromFile = the probe file, module = `../persistence/repositories`) and
 *    `check_file` (the probe file's path and content). Neither reads a graph, so Neo4j is never contacted.
 * 2. **What the scorer counts.** The same project is evaluated in process exactly as the loop evaluator does
 *    (`evaluateProject`, scoring v1.3, cypher-interp, `presets/layered.yaml`, harness tsconfig), and the FF-S03 rows
 *    are read per probe file.
 * 3. **Name patterns.** For each probe file: Q25 = B's `CONSTRUCT_COMPOSITION_ROOT_GLOBS` (the scorer's exemption) and
 *    `APG2_COMPOSITION_ROOT_NAME_PATTERNS` (the MCP fast-hint exemption), and whether they disagree.
 * Writes the JSON to --out and a table to stdout.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { createPipeline, postSealRulesOf } from '../../src/pipeline/pipeline-factory.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { createInterpEvaluator } from '../../src/mcp-server/interp-evaluator.js';
import { evaluateProject } from '../../src/mcp-server/evaluate-project.js';
import { CONSTRUCT_COMPOSITION_ROOT_GLOBS, globMatcher } from '../../src/construct-switches/overlays.js';
import { APG2_COMPOSITION_ROOT_NAME_PATTERNS, matchesAny } from '../../src/shared/apg2-scope.js';

export {};

/** `main.ts` and `server.ts` are the two names the review asks for; the rest map the pattern lists' differences. */
const PROBE_FILES = [
  'src/presentation/main.ts', 'src/presentation/server.ts', 'src/presentation/app.ts', 'src/presentation/index.ts',
  'src/presentation/composition.ts', 'src/presentation/bootstrap.ts', 'src/presentation/di.ts', 'src/presentation/container.ts',
  'src/presentation/AppContainer.ts', 'src/presentation/app.container.ts', 'src/presentation/app.module.ts',
  'src/presentation/composition-root.ts', 'src/presentation/compositionRoot.ts', 'src/presentation/composition-root/index.ts',
];
const MODULE = '../persistence/repositories';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

function writeProject(dir: string, nodeModules: string): void {
  const put = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  };
  put('package.json', '{ "name": "cr-probe", "private": true }\n');
  put('src/persistence/repositories.ts', 'export interface HiveRepo { all(): string[] }\nexport class MemoryHiveRepo implements HiveRepo { all(): string[] { return []; } }\n');
  put('src/business/service.ts', "import type { HiveRepo } from '../persistence/repositories';\nexport class HiveService { constructor(private readonly repo: () => HiveRepo) {} list(): string[] { return this.repo().all(); } }\n");
  for (const f of PROBE_FILES) {
    const rel = path.posix.relative(path.posix.dirname(f), 'src/persistence/repositories');
    put(f, `import { MemoryHiveRepo } from '${rel.startsWith('.') ? rel : `./${rel}`}';\nimport { HiveService } from '${path.posix.relative(path.posix.dirname(f), 'src/business/service').replace(/^(?!\.)/, './')}';\nexport const service = new HiveService(() => new MemoryHiveRepo());\n`);
  }
  fs.symlinkSync(nodeModules, path.join(dir, 'node_modules'));
}

interface Rpc { id?: number; result?: { content?: { type: string; text: string }[]; isError?: boolean }; error?: unknown }

async function mcpProbe(build: string, project: string): Promise<{ tools: string[]; calls: { file: string; tool: string; text: string; isError: boolean }[] }> {
  const child = spawn(path.join(build, 'node'), [path.join(build, 'dist/mcp-server/main.js'), '--spec', path.join(build, 'presets/layered.yaml'), '--project', project, '--engine', 'neo4j', '--confine'], { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH ?? '' } });
  let buf = '';
  const waiting = new Map<number, (r: Rpc) => void>();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d: string) => {
    buf += d;
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line === '') continue;
      const msg = JSON.parse(line) as Rpc;
      if (msg.id !== undefined) waiting.get(msg.id)?.(msg);
    }
  });
  child.stderr.resume();
  let next = 1;
  const call = (method: string, params: unknown): Promise<Rpc> => new Promise((resolve, reject) => {
    const id = next++;
    const t = setTimeout(() => reject(new Error(`${method}: no answer in 60 s`)), 60_000);
    waiting.set(id, (r) => { clearTimeout(t); resolve(r); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  try {
    await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'cr-exemption-probe', version: '1' } });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const list = await call('tools/list', {});
    const tools = ((list.result as unknown as { tools?: { name: string }[] } | undefined)?.tools ?? []).map((t) => t.name).sort();
    const calls: { file: string; tool: string; text: string; isError: boolean }[] = [];
    for (const file of PROBE_FILES) {
      const content = fs.readFileSync(path.join(project, file), 'utf8');
      for (const [tool, a] of [['check_import', { from: file, module: path.posix.relative(path.posix.dirname(file), 'src/persistence/repositories').replace(/^(?!\.)/, './') }], ['check_file', { path: file, content }]] as const) {
        const r = await call('tools/call', { name: tool, arguments: a });
        const text = (r.result?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
        calls.push({ file, tool, text: text.split(project).join('<project>'), isError: r.result?.isError === true || r.error !== undefined });
      }
    }
    return { tools, calls };
  } finally {
    child.kill();
  }
}

async function scorerProbe(project: string): Promise<Map<string, number>> {
  const tsconfig = `${project}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(project), null, 2)}\n`);
  const repo = new MemoryGraphRepository();
  const interp = createInterpEvaluator({ makePipeline: (config) => createPipeline({ ...config, postSealRules: postSealRulesOf(config), graphRepository: repo }) });
  const r = await evaluateProject(
    { projectPath: project, specPath: path.resolve('presets/layered.yaml'), scoringMode: 'v1.3', includeViolations: true, tsconfigPath: tsconfig },
    {},
    { makeGraph: () => { throw new Error('cr-exemption-probe: Neo4j is never used'); }, makePipeline: createPipeline, graphEngine: 'cypher-interp', interp },
  );
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  const out = new Map<string, number>(PROBE_FILES.map((f) => [f, 0]));
  for (const v of (r.data.violations ?? []) as unknown as readonly { functionId?: string; filePath?: string }[]) {
    if (v.functionId === 'FF-S03' && v.filePath !== undefined && out.has(v.filePath)) out.set(v.filePath, (out.get(v.filePath) ?? 0) + 1);
  }
  return out;
}

/** The verdict line of a tool answer, shortened: does the answer flag the import? */
function flags(text: string): 'flags' | 'allows' | 'unclear' {
  if (/FF-S03|no-layer-skip|skips? (a )?layer|not directly below|layer skip/i.test(text)) return 'flags';
  if (/no violation|allowed|"allowed"\s*:\s*true|verdict"?\s*:\s*"?pass/i.test(text)) return 'allows';
  return 'unclear';
}

async function main(): Promise<number> {
  const build = arg('build');
  const nm = arg('node-modules');
  const out = arg('out') ?? 'results/v1.4-study2b-prereg/cr-exemption-probe.json';
  if (build === undefined || nm === undefined) {
    process.stderr.write('usage: cr-exemption-probe.ts --build <dir> --node-modules <dir> [--out <file>]\n');
    return 2;
  }
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-probe-'));
  try {
    writeProject(project, path.resolve(nm));
    const mcp = await mcpProbe(path.resolve(build), project);
    const scorer = await scorerProbe(project);
    const isQ25 = globMatcher(CONSTRUCT_COMPOSITION_ROOT_GLOBS);
    const rows = PROBE_FILES.map((file) => {
      const ci = mcp.calls.find((c) => c.file === file && c.tool === 'check_import');
      const cf = mcp.calls.find((c) => c.file === file && c.tool === 'check_file');
      const q25 = isQ25(file);
      const hint = matchesAny(APG2_COMPOSITION_ROOT_NAME_PATTERNS, file);
      return {
        file, scorerFF_S03: scorer.get(file) ?? 0, q25Exempt: q25, mcpFastHintExempt: hint, patternsDisagree: q25 !== hint,
        checkImport: ci === undefined ? null : { reads: flags(ci.text), isError: ci.isError, text: ci.text },
        checkFile: cf === undefined ? null : { reads: flags(cf.text), isError: cf.isError, text: cf.text },
      };
    });
    const result = {
      schema: 'cr-exemption-probe/v1', build: '<frozen MCP build at the tag>', spec: 'presets/layered.yaml', module: MODULE,
      exemptions: { scorerQ25Globs: CONSTRUCT_COMPOSITION_ROOT_GLOBS, mcpFastHintPatterns: APG2_COMPOSITION_ROOT_NAME_PATTERNS },
      toolsListed: mcp.tools, rows,
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
    process.stdout.write('| File | scorer FF-S03 rows | Q25 exempt | MCP hint exempt | check_import | check_file |\n|---|---|---|---|---|---|\n');
    for (const r of rows) process.stdout.write(`| ${r.file} | ${String(r.scorerFF_S03)} | ${String(r.q25Exempt)} | ${String(r.mcpFastHintExempt)} | ${r.checkImport?.reads ?? '—'} | ${r.checkFile?.reads ?? '—'} |\n`);
    return 0;
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(`${project}.tsconfig.json`, { force: true });
  }
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
