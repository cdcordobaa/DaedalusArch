/**
 * v1.3 npx mode (Docs/v1.3/npx-mode.md): the MCP server on the in-process Cypher interpreter, no database.
 * evaluate_project runs the real pipeline on cypher-interp; check_file / check_diff with `templates: true` run the
 * compiled templates before and after the change and report what it introduces. No NEO4J variable is read.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext, parseArgs, serverEngine } from '../../../src/mcp-server/context.js';
import { checkDiffTool, checkFileTool, evaluateProjectTool } from '../../../src/mcp-server/tools.js';
import { createInterpEvaluator, projectFingerprint } from '../../../src/mcp-server/interp-evaluator.js';
import { evaluateProject } from '../../../src/mcp-server/evaluate-project.js';
import { CLEAN_ARCH_SPEC, FIXTURES } from './helpers.js';

const PROJECT = path.join(FIXTURES, 'correct-reference');
const CATEGORY = 'src/domain/entities/Category.ts';
const NO_DB: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '' };

const LEAK = `import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';

export class Category {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: string
  ) {}

  repo(): InMemoryTaskRepository {
    return new InMemoryTaskRepository();
  }

  isValid(): boolean {
    return this.name.length > 0;
  }
}
`;

function ctx() {
  return buildContext(parseArgs(['--spec', CLEAN_ARCH_SPEC, '--project', PROJECT]), NO_DB);
}

describe('engine selection', () => {
  it('no NEO4J_URI → cypher-interp; NEO4J_URI → neo4j; --engine wins', () => {
    expect(serverEngine({}, NO_DB)).toEqual({ engine: 'cypher-interp', source: 'no-neo4j-uri' });
    expect(serverEngine({}, { NEO4J_URI: 'bolt://h:7687' })).toEqual({ engine: 'neo4j', source: 'neo4j-uri-env' });
    expect(serverEngine({ engine: 'neo4j' }, NO_DB)).toEqual({ engine: 'neo4j', source: 'flag' });
    expect(serverEngine({ engine: 'memory' }, NO_DB)).toBeUndefined();
    expect(parseArgs(['--engine', 'cypher-interp', '--spec=s.yaml'])).toEqual({ engine: 'cypher-interp', spec: 's.yaml' });
    const c = ctx();
    expect(c.graphEngine).toBe('cypher-interp');
    expect(c.evaluateDeps.interp).toBeDefined();
    expect(buildContext({}, { NEO4J_URI: 'bolt://h:7687' }).evaluateDeps.interp).toBeUndefined();
  });
});

describe('evaluate_project on cypher-interp (no database)', () => {
  it('matches the golden snapshot counts and answers an unchanged project from the cache', async () => {
    const c = buildContext(parseArgs(['--spec', CLEAN_ARCH_SPEC, '--project', path.join(FIXTURES, 'variant-a-structural')]), NO_DB);
    const first = await evaluateProjectTool(c, { scoring: 'v1.2e' });
    if (!first.ok) throw new Error(first.message);
    const golden = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../golden/__snapshots__/variant-a-structural.json'), 'utf8'),
    ) as { ahsDeterministic: number; verdict: string; violations: unknown[] };
    expect(first.data.engine).toBe('cypher-interp');
    expect(first.data.cache).toBe('miss');
    expect(first.data.ahs).toBe(golden.ahsDeterministic);
    expect(first.data.verdict).toBe(golden.verdict);
    expect(first.data.violationCount).toBe(golden.violations.length);
    const second = await evaluateProjectTool(c, { scoring: 'v1.2e' });
    if (!second.ok) throw new Error(second.message);
    expect(second.data.cache).toBe('hit');
    expect(second.data.byRule).toEqual(first.data.byRule);
  }, 60_000);
});

describe('check_file / check_diff with templates (no database)', () => {
  it('check_file: a domain entity importing infrastructure introduces a blocking template finding', async () => {
    const res = await checkFileTool(ctx(), { path: CATEGORY, content: LEAK, templates: true });
    if (!res.ok) throw new Error(res.message);
    const t = res.data.templates;
    expect(t?.status).toBe('checked');
    expect(t?.engine).toBe('cypher-interp');
    expect(t?.blockingVerdict).toBe('block');
    const onFile = (t?.introduced ?? []).filter((f) => f.filePath === CATEGORY);
    expect(onFile.length).toBeGreaterThan(0);
    expect(onFile.some((f) => f.tier === 'blocking' && f.target === 'src/infrastructure/repositories/InMemoryTaskRepository.ts')).toBe(true);
    expect(t?.cache).toEqual({ before: 'miss', after: 'miss' });
  }, 60_000);

  it('check_file: unchanged content introduces nothing; without templates the field is absent', async () => {
    const c = ctx();
    const content = fs.readFileSync(path.join(PROJECT, CATEGORY), 'utf8');
    const res = await checkFileTool(c, { path: CATEGORY, content, templates: true });
    if (!res.ok) throw new Error(res.message);
    expect(res.data.templates?.introduced).toEqual([]);
    expect(res.data.templates?.blockingVerdict).toBe('pass');
    const fast = await checkFileTool(c, { path: CATEGORY, content });
    if (!fast.ok) throw new Error(fast.message);
    expect(fast.data.templates).toBeUndefined();
  }, 60_000);

  it('check_diff: the same leak as a diff; the disk is never written', async () => {
    const before = projectFingerprint(PROJECT);
    const diff = [
      `--- a/${CATEGORY}`,
      `+++ b/${CATEGORY}`,
      '@@ -1,3 +1,5 @@',
      "+import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';",
      '+',
      ' export class Category {',
      '   constructor(',
      '     public readonly id: string,',
      '',
    ].join('\n');
    const res = await checkDiffTool(ctx(), { diff, templates: true });
    if (!res.ok) throw new Error(res.message);
    expect(res.data.templates?.status).toBe('checked');
    expect(res.data.templates?.introduced.some((f) => f.filePath === CATEGORY)).toBe(true);
    expect(projectFingerprint(PROJECT)).toBe(before);
  }, 60_000);

  it('on the neo4j engine the template check is skipped with a reason (it never touches Neo4j)', async () => {
    const c = buildContext(parseArgs(['--spec', CLEAN_ARCH_SPEC, '--project', PROJECT, '--engine', 'neo4j']), NO_DB);
    const res = await checkFileTool(c, { path: CATEGORY, content: LEAK, templates: true });
    if (!res.ok) throw new Error(res.message);
    expect(res.data.templates).toMatchObject({ status: 'skipped', blockingVerdict: 'unknown' });
  });
});

describe('createInterpEvaluator', () => {
  it('fails cleanly on a missing spec', async () => {
    const res = await createInterpEvaluator()({ projectPath: PROJECT, specPath: '/nonexistent/spec.yaml', scoringMode: 'v1.3' });
    expect(res.success).toBe(false);
  });
});

describe('evaluate_project on cypher-interp: explicit tsconfig and uncapped violations (loop harness path)', () => {
  it('a work tree without its own tsconfig is evaluated with the given tsconfigPath, and includeViolations lists the findings', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'interp-tsconfig-'));
    try {
      const work = path.join(tmp, 'work');
      for (const [rel, text] of Object.entries({
        'src/domain/item.ts': "import { ItemStore } from '../infrastructure/item-store';\n\nexport interface Item {\n  readonly id: string;\n}\n\nexport function saveItem(item: Item): void {\n  new ItemStore().put(item.id);\n}\n",
        'src/application/item-service.ts': "import type { Item } from '../domain/item';\n\nexport class ItemService {\n  list(): readonly Item[] {\n    return [];\n  }\n}\n",
        'src/infrastructure/item-store.ts': 'export class ItemStore {\n  put(_id: string): void {}\n}\n',
      })) {
        fs.mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
        fs.writeFileSync(path.join(work, rel), text);
      }
      const tsconfig = path.join(tmp, 'harness', 'tsconfig.json');
      fs.mkdirSync(path.dirname(tsconfig), { recursive: true });
      fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', noEmit: true }, include: [`${work}/src/**/*.ts`] }));
      const deps = ctx().evaluateDeps;
      const without = await evaluateProject({ projectPath: work, specPath: CLEAN_ARCH_SPEC, scoringMode: 'v1.3' }, NO_DB, deps);
      expect(without.success).toBe(false);
      const res = await evaluateProject({ projectPath: work, specPath: CLEAN_ARCH_SPEC, scoringMode: 'v1.3', tsconfigPath: tsconfig, includeViolations: true }, NO_DB, deps);
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.data.engine).toBe('cypher-interp');
      expect(res.data.tiers?.blocking.violationCount ?? 0).toBeGreaterThan(0);
      expect(res.data.violations?.some((v) => v.filePath.endsWith('domain/item.ts'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
