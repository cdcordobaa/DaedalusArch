/**
 * DA1 (`Docs/v1.4/study2b-preregistration-addendum-1.md`): the MCP fast path and the full evaluation agree on the
 * Q25 = B composition-root exemption. The case is the pre-registration §4 zero-call probe: a Layered project whose
 * `src/presentation/main.ts` imports persistence (a presentation → persistence edge, FF-S03 no-layer-skip). The scorer
 * exempts `main.ts`; `src/presentation/server.ts`, the same file under a name no glob matches, is the control and stays
 * flagged. No Neo4j: the full evaluation runs on cypher-interp.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../../src/mcp-server/context.js';
import { checkDiffTool, checkFileTool, checkImportTool } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { checkSource } from '../../../src/mcp-server/file-check.js';
import { evaluateProject } from '../../../src/mcp-server/evaluate-project.js';
import { withPostSealRules } from '../../../src/fitness-compiler/post-seal-rules.js';
import { CONSTRUCT_ANSWERS } from '../../../src/shared/construct-switches.js';
import { loadSpec, REPO } from './helpers.js';

const SPEC = path.join(REPO, 'presets/layered.yaml');
const NO_DB: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '' };
const EXEMPT = 'src/presentation/main.ts';
const CONTROL = 'src/presentation/server.ts';
const WIRING = "import { MemoryHiveRepo } from '../persistence/repositories';\nimport { HiveService } from '../business/service';\nexport const service = new HiveService(() => new MemoryHiveRepo());\n";

let dir: string;
let ctx: ServerContext;

const put = (rel: string, body: string): void => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), body);
};

/** A new-file unified diff of `rel` with `body`. */
function newFileDiff(rel: string, body: string): string {
  const lines = body.split('\n').filter((l, i, all) => i < all.length - 1 || l !== '');
  return [`--- /dev/null`, `+++ b/${rel}`, `@@ -0,0 +1,${String(lines.length)} @@`, ...lines.map((l) => `+${l}`), ''].join('\n');
}

const s03 = (rules: readonly { readonly ruleId: string }[]): number => rules.filter((r) => r.ruleId === 'FF-S03').length;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da1-cr-'));
  put('package.json', '{ "name": "da1-cr", "private": true }\n');
  put('tsconfig.json', '{ "compilerOptions": { "strict": true, "target": "ES2022", "module": "commonjs" }, "include": ["src/**/*.ts"] }\n');
  put('src/persistence/repositories.ts', 'export interface HiveRepo { all(): string[] }\nexport class MemoryHiveRepo implements HiveRepo { all(): string[] { return []; } }\n');
  put('src/business/service.ts', "import type { HiveRepo } from '../persistence/repositories';\nexport class HiveService { constructor(private readonly repo: () => HiveRepo) {} list(): string[] { return this.repo().all(); } }\n");
  put(EXEMPT, WIRING);
  put(CONTROL, WIRING);
  ctx = buildContext(parseArgs(['--spec', SPEC, '--project', dir, '--engine', 'cypher-interp']), NO_DB);
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('DA1: composition-root exemption, MCP fast path against the full evaluation', () => {
  it('the construct answers exempt composition roots (Q25 = B)', () => {
    expect(CONSTRUCT_ANSWERS.Q25).toBe('B');
  });

  it('before the fix: the spec without the Q25 overlay flags main.ts (the §4 probe disagreement)', async () => {
    const unfixed = withPostSealRules(await loadSpec(SPEC));
    const r = checkSource(unfixed, { path: EXEMPT, content: WIRING });
    expect(s03(r.violations)).toBe(1);
  });

  it('the full evaluation exempts main.ts and counts the control', async () => {
    const r = await evaluateProject(
      { projectPath: dir, specPath: SPEC, scoringMode: 'v1.3', includeViolations: true },
      NO_DB,
      ctx.evaluateDeps,
    );
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    const rows = ((r.data.violations ?? []) as unknown as readonly { functionId?: string; filePath?: string }[])
      .filter((v) => String(v.functionId) === 'FF-S03');
    expect(rows.filter((v) => v.filePath === EXEMPT)).toHaveLength(0);
    expect(rows.filter((v) => v.filePath === CONTROL).length).toBeGreaterThan(0);
  }, 120_000);

  it('check_file agrees: main.ts passes FF-S03, the control is flagged', async () => {
    const exempt = await checkFileTool(ctx, { path: EXEMPT, content: WIRING });
    const control = await checkFileTool(ctx, { path: CONTROL, content: WIRING });
    if (!exempt.ok || !control.ok) throw new Error('check_file failed');
    expect(s03(exempt.data.violations)).toBe(0);
    expect(s03(control.data.violations)).toBe(1);
  });

  it('check_diff agrees on new-file diffs of the same two files', async () => {
    const exempt = await checkDiffTool(ctx, { diff: newFileDiff(EXEMPT, WIRING) });
    const control = await checkDiffTool(ctx, { diff: newFileDiff(CONTROL, WIRING) });
    if (!exempt.ok || !control.ok) throw new Error('check_diff failed');
    expect(exempt.data.files.flatMap((f) => f.violations).filter((v) => v.ruleId === 'FF-S03')).toHaveLength(0);
    expect(control.data.files.flatMap((f) => f.violations).filter((v) => v.ruleId === 'FF-S03')).toHaveLength(1);
  });

  it('check_import agrees', async () => {
    const exempt = await checkImportTool(ctx, { from: EXEMPT, module: '../persistence/repositories' });
    const control = await checkImportTool(ctx, { from: CONTROL, module: '../persistence/repositories' });
    if (!exempt.ok || !control.ok) throw new Error('check_import failed');
    expect(s03(exempt.data.violations)).toBe(0);
    expect(s03(control.data.violations)).toBe(1);
  });
});
