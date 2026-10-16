/**
 * Extraction scale controls (Docs/v1.3/scale.md §5, §6): `--max-files`, the memory guard, `--skip-excluded-sources`,
 * and the single compiler-tree scan of dynamic imports.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import { findDynamicImportCalls } from '../../../src/apg-extractor/import-resolver.js';
import { MemoryGuard } from '../../../src/shared/process/memory-guard.js';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/correct-reference');

function tempProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-limits-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

describe('--max-files', () => {
  it('fails with PROJECT_TOO_LARGE before parsing when the analysable files exceed the cap', async () => {
    const result = await extractAPG(FIXTURE, {}, undefined, { maxFiles: 3 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.code).toBe('PROJECT_TOO_LARGE');
    expect(result.errors[0]?.message).toMatch(/^Project too large: 10 source files to analyse in .* after the exclusions, over --max-files 3\./);
  });

  it('leaves the APG unchanged when the project is within the cap', async () => {
    const plain = await extractAPG(FIXTURE);
    const capped = await extractAPG(FIXTURE, {}, undefined, { maxFiles: 10 });
    expect(JSON.stringify(capped)).toBe(JSON.stringify(plain));
  });
});

describe('memory guard', () => {
  it('turns a guard stop into MEMORY_LIMIT_EXCEEDED', async () => {
    const guard = new MemoryGuard({ heapLimitBytes: 1, read: () => ({ heapUsedBytes: 10, rssBytes: 0 }), collect: () => {} });
    const result = await extractAPG(FIXTURE, {}, undefined, { memoryGuard: guard });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.code).toBe('MEMORY_LIMIT_EXCEEDED');
    expect(result.errors[0]?.message).toContain('Project too large for the available memory');
  });

  it('leaves the APG unchanged when memory is within budget', async () => {
    const plain = await extractAPG(FIXTURE);
    const guarded = await extractAPG(FIXTURE, {}, undefined, { memoryGuard: new MemoryGuard() });
    expect(JSON.stringify(guarded)).toBe(JSON.stringify(plain));
  });
});

describe('--skip-excluded-sources', () => {
  it('gives the same APG when excluded files are not loaded, keeping declaration files', async () => {
    const dir = tempProject({
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', experimentalDecorators: true }, include: ['src/**/*.ts', 'types/**/*.d.ts'] }),
      'types/globals.d.ts': 'declare interface Clock { now(): number }\n',
      'src/domain/order.ts': 'export class Order { constructor(private readonly clock: Clock) {} total(): number { return this.clock.now(); } }\n',
      'src/app/service.ts': "import { Order } from '../domain/order';\nexport class OrderService { constructor(private readonly order: Order) {} run(): number { return this.order.total(); } }\n",
      'src/app/service.spec.ts': "import { OrderService } from './service';\nexport const s: OrderService | undefined = undefined;\n",
    });
    const full = await extractAPG(dir);
    const analysed = await extractAPG(dir, {}, undefined, { sourceScope: 'analysed' });
    expect(full.success).toBe(true);
    expect(JSON.stringify(analysed)).toBe(JSON.stringify(full));
  });
});

describe('findDynamicImportCalls', () => {
  it('finds the calls of getDescendantsOfKind, in order, with ts-morph start lines on every line ending', () => {
    const text = [
      "const a = require('./a');\r\n",
      "async function f() {\r  return import('./b'); }\n",
      "const c = requir\\u0065('./c');\n",
      "const d = require(name);\n",
      "const e = wrap(import(`./e`), require('./f'));\n",
      "const g = obj.require('./g');\n",
    ].join('');
    const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('/x.ts', text);
    const expected = sf.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => {
        const callee = call.getExpression();
        return callee.getKind() === SyntaxKind.ImportKeyword || (callee.getKind() === SyntaxKind.Identifier && callee.getText() === 'require');
      })
      .map((call) => {
        const arg = call.getArguments()[0];
        const literal = arg !== undefined && (arg.getKind() === SyntaxKind.StringLiteral || arg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral);
        return { line: call.getStartLineNumber(), specifier: literal ? (arg as unknown as { getLiteralText(): string }).getLiteralText() : undefined };
      });
    expect(findDynamicImportCalls(sf)).toEqual(expected);
    expect(expected.map((c) => c.specifier)).toEqual(['./a', './b', './c', undefined, './e', './f']);
    expect(findDynamicImportCalls(sf)).toBe(findDynamicImportCalls(sf));
    sf.replaceWithText("const z = require('./z');\n");
    expect(findDynamicImportCalls(sf)).toEqual([{ line: 1, specifier: './z' }]);
  });
});
