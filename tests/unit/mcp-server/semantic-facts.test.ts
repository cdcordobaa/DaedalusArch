/**
 * v1.4 U9 S5: the opt-in, read-only `semantic_facts` MCP tool. Off by default (the default tool list, the spec-tool
 * list and the study arms are unchanged); on with `--semantic-facts <dir>` or DAEDALUS_SEMANTIC_FACTS. It returns the
 * recorded A2 facts and Sem findings checked against the current code (stale facts left out), reads only through the
 * confined project view, and writes nothing. The A2 files come from the ontology runner in mock replay (0 model calls).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { main as ontologyRun } from '../../../scripts/v1.3/ontology-run.js';
import type { FactsFile } from '../../../src/apg-enrich/ontology/index.js';
import { buildContext, parseArgs } from '../../../src/mcp-server/context.js';
import { SEMANTIC_FACTS_TOOL, semanticFactsConfigOf, semanticFactsTool } from '../../../src/mcp-server/semantic-facts.js';
import type { SemanticFactsResult } from '../../../src/mcp-server/semantic-facts.js';
import { SEMANTIC_TOOL_NAMES, SPEC_TOOL_NAMES, TOOL_NAMES, createServer, toolNamesFor } from '../../../src/mcp-server/server.js';
import { createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';

const ONTO = 'tests/fixtures/v1.3-ontology';
const CASE = 'case-02-misplaced-pricing';
const SERVICE = 'src/notifications/application/order-notification.service.ts';

let base: string;
let project: string;
let a2Dir: string;

beforeAll(async () => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sem-mcp-')));
  project = path.join(base, 'work', CASE);
  fs.cpSync(path.join(ONTO, CASE), project, { recursive: true });
  const out = path.join(base, 'a2');
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const code = await ontologyRun(['--project', project, '--layers', path.join(ONTO, 'layers.json'), '--provider', 'mock', '--replay', '--cassettes', path.join(ONTO, 'cassettes-mock'), '--out', out]);
    expect(code).toBe(0);
  } finally {
    spy.mockRestore();
  }
  a2Dir = path.join(out, CASE);
}, 300_000);

afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

function ctx(over: Partial<ServerContext> = {}): ServerContext {
  return { defaultProjectPath: project, env: {}, loadSpec: createSpecLoader(), evaluateDeps: { makeGraph: jest.fn(), makePipeline: jest.fn() }, ...over } as ServerContext;
}

async function connect(c: ServerContext): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer(c);
  const client = new Client({ name: 't', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

function ok(r: SemanticFactsResult): Extract<SemanticFactsResult, { status: 'ok' }> {
  if (r.status !== 'ok') throw new Error(`${r.status}: ${r.message}`);
  return r;
}

describe('semantic_facts: off by default, on behind a flag', () => {
  it('is not registered by default and changes no existing tool list', async () => {
    expect(buildContext(parseArgs([]), {}).semanticFacts).toBeUndefined();
    expect(toolNamesFor({})).toEqual(TOOL_NAMES);
    expect(TOOL_NAMES).not.toContain(SEMANTIC_FACTS_TOOL);
    expect(SPEC_TOOL_NAMES).not.toContain(SEMANTIC_FACTS_TOOL);
    const off = await connect(ctx());
    expect((await off.client.listTools()).tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    await off.close();
  });

  it('turns on with --semantic-facts <dir> or DAEDALUS_SEMANTIC_FACTS, registered last with read-only annotations', async () => {
    expect(parseArgs(['--semantic-facts', 'x/a2']).semanticFacts).toBe('x/a2');
    expect(buildContext(parseArgs(['--semantic-facts=/a2']), {}).semanticFacts).toEqual({ dir: path.resolve('/a2') });
    expect(buildContext(parseArgs([]), { DAEDALUS_SEMANTIC_FACTS: '/b2' }).semanticFacts).toEqual({ dir: path.resolve('/b2') });
    expect(semanticFactsConfigOf(undefined, { DAEDALUS_SEMANTIC_FACTS: '' })).toBeUndefined();
    expect(toolNamesFor({ semanticFacts: { dir: a2Dir } })).toEqual([...TOOL_NAMES, ...SEMANTIC_TOOL_NAMES]);
    const on = await connect(ctx({ semanticFacts: { dir: a2Dir } }));
    const tools = (await on.client.listTools()).tools;
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES, SEMANTIC_FACTS_TOOL]);
    expect(tools.find((t) => t.name === SEMANTIC_FACTS_TOOL)?.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    const res = await on.client.callTool({ name: SEMANTIC_FACTS_TOOL, arguments: {} });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as { status: string }).status).toBe('ok');
    await on.close();
  });
});

describe('semantic_facts: the recorded facts and Sem findings for the current snapshot', () => {
  it('returns the SEM-MISPLACED finding with its model facts, advisory, and the snapshot as current', () => {
    const r = ok(semanticFactsTool({ dir: a2Dir }, project, {}));
    expect(r.source).toMatchObject({ project: CASE, provider: 'mock', factPolicy: 'agreed-only', findingsRecorded: true });
    expect(r.snapshot).toMatchObject({ staleFacts: 0, current: true });
    expect(r.snapshot.checkedFacts).toBeGreaterThan(0);
    expect(r.findings.map((f) => [f.rule, f.blocking, f.stale])).toEqual([['SEM-MISPLACED', false, false]]);
    const cited = new Set(r.findings[0]?.facts);
    expect(r.facts.filter((f) => cited.has(f.id)).every((f) => f.source === 'model' && f.agreement === 'agreed')).toBe(true);
    expect(r.findings[0]?.files).toContain(SERVICE);
    expect(r.note).toContain('Facts, not verdicts');
  });

  it('filters by file and by fact policy', () => {
    const all = ok(semanticFactsTool({ dir: a2Dir }, project, { policy: 'any' }));
    const agreed = ok(semanticFactsTool({ dir: a2Dir }, project, {}));
    expect(all.counts.facts).toBeGreaterThanOrEqual(agreed.counts.facts);
    expect(agreed.facts.every((f) => f.source === 'parser' || f.agreement === 'agreed')).toBe(true);
    const one = ok(semanticFactsTool({ dir: a2Dir }, project, { file: `./${SERVICE}` }));
    expect(one.facts.length).toBeGreaterThan(0);
    expect(one.facts.every((f) => f.files.includes(SERVICE))).toBe(true);
    expect(ok(semanticFactsTool({ dir: a2Dir }, project, { file: 'src/none.ts' })).findings).toEqual([]);
  });

  it('marks facts stale when their cited code changed, and leaves them out unless includeStale', () => {
    const copy = path.join(base, 'work-stale', CASE);
    fs.cpSync(project, copy, { recursive: true });
    const file = path.join(copy, SERVICE);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('subtotal * 0.1', 'subtotal * 0.2'));
    const r = ok(semanticFactsTool({ dir: a2Dir }, copy, {}));
    expect(r.snapshot.current).toBe(false);
    expect(r.snapshot.staleFacts).toBeGreaterThan(0);
    expect(r.findings).toEqual([]);
    const all = ok(semanticFactsTool({ dir: a2Dir }, copy, { includeStale: true }));
    expect(all.findings.map((f) => [f.rule, f.stale])).toEqual([['SEM-MISPLACED', true]]);
  });

  it('reads nothing outside the project root: an escaping citation or a symlink out of the root is stale, never read', () => {
    const outside = path.join(base, 'outside.ts');
    fs.writeFileSync(outside, 'export const secret = 1;\n');
    fs.symlinkSync(outside, path.join(project, 'src', 'link.ts'));
    const a2 = JSON.parse(fs.readFileSync(path.join(a2Dir, 'facts.json'), 'utf8')) as FactsFile;
    const model = a2.facts.find((f) => f.source === 'model');
    if (model === undefined) throw new Error('no model fact');
    const escape = (file: string): FactsFile['facts'][number] => ({ ...model, id: `fact:${file}`, evidence: [{ ...model.evidence[0], file, startLine: 1, endLine: 1, quote: 'export const secret = 1;' } as typeof model.evidence[number]] });
    const dir = path.join(base, 'a2-escape');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify({ ...a2, facts: [escape('../../outside.ts'), escape('src/link.ts')] }));
    try {
      // Both cited lines hold the quote verbatim outside the root: had either been read, the fact would not be stale.
      const r = ok(semanticFactsTool({ dir }, project, { includeStale: true }));
      expect(r.facts.map((f) => f.stale)).toEqual([true, true]);
      expect(r.source.findingsRecorded).toBe(false);
    } finally {
      fs.rmSync(path.join(project, 'src', 'link.ts'));
    }
  });

  it('writes nothing, and its module imports no process, network or write API', () => {
    const tree = (root: string): string[] => fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .map((e) => { const p = path.join(e.parentPath, e.name); const st = fs.lstatSync(p); return `${path.relative(root, p)}|${String(st.size)}|${String(st.mtimeMs)}`; }).sort();
    const before = [tree(project), tree(a2Dir)];
    ok(semanticFactsTool({ dir: a2Dir }, project, { includeStale: true, policy: 'any' }));
    expect([tree(project), tree(a2Dir)]).toEqual(before);
    const src = fs.readFileSync('src/mcp-server/semantic-facts.ts', 'utf8');
    for (const m of ["'node:child_process'", "'child_process'", "'node:net'", "'node:http'", "'node:https'", "'node:dgram'", 'fetch(', 'writeFile', 'mkdir', 'appendFile', 'rmSync', 'unlink']) {
      expect({ m, found: src.includes(m) }).toEqual({ m, found: false });
    }
  });

  it('answers not-configured without a directory, and unavailable without a project or an A2 file', () => {
    expect(semanticFactsTool(undefined, project, {})).toMatchObject({ status: 'not-configured' });
    expect(semanticFactsTool({ dir: a2Dir }, undefined, {})).toMatchObject({ status: 'unavailable' });
    expect(semanticFactsTool({ dir: path.join(base, 'nope') }, project, {})).toMatchObject({ status: 'unavailable' });
  });
});
