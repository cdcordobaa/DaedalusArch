/**
 * Minimal repro (v1.3 judge catch round 2, finding F-P01-ALIAS): an import of a forbidden package that tsconfig
 * `paths` aliases to a local `.d.ts` stub yields no IMPORTS edge at all, so FF-P01 `domain-purity` cannot fire.
 *
 * Four projects, one domain file `src/domain/user.ts` that does `import { Column, Entity } from 'typeorm'`:
 *   A  `paths: { typeorm: ['vendor/typeorm'] }` -> `vendor/typeorm.d.ts` (the antipattern-nest fixture's shape)
 *   B  the same alias to a `.ts` stub `vendor/typeorm.ts`
 *   C  an ambient `declare module 'typeorm'` in `types/vendor.d.ts` (the v1.3 reference projects' shape)
 *   D  `fixtures/unit/antipattern-nest` as committed (file `src/invoice/invoice.entity.ts`)
 * Prints the IMPORTS targets of the file, the Package nodes and the extractor warnings on the file.
 * Extractor only (V13_DEFAULT_OPTIONS): no Neo4j, no model. This unit records the defect; it does not fix it.
 *
 * Usage (repository root): npx tsx scripts/v1.3/judge-catch2-ffp01-repro.ts <scratch dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';
import type { APGResult } from '../../src/shared/types/apg.js';

const ENTITY = "import { Column, Entity } from 'typeorm';\n\n@Entity()\nexport class User {\n  @Column()\n  name = '';\n}\n";
const STUB_DTS = 'export declare function Entity(): ClassDecorator;\nexport declare function Column(): PropertyDecorator;\n';
const STUB_TS = 'export function Entity(): ClassDecorator { return () => undefined; }\nexport function Column(): PropertyDecorator { return () => undefined; }\n';
const AMBIENT = "declare module 'typeorm' {\n  export function Entity(): ClassDecorator;\n  export function Column(): PropertyDecorator;\n}\n";
const OPTIONS = { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, experimentalDecorators: true, skipLibCheck: true, noEmit: true };

function project(root: string, name: string, files: Record<string, string>, extra: Record<string, unknown>, include: string[]): string {
  const dir = path.join(root, name);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { ...OPTIONS, ...extra }, include }, null, 2));
  return dir;
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const scratch = argv[0];
  if (scratch === undefined) {
    process.stderr.write('usage: judge-catch2-ffp01-repro.ts <scratch dir>\n');
    return 2;
  }
  const root = path.resolve(scratch);
  const alias = { baseUrl: '.', paths: { typeorm: ['vendor/typeorm'] } };
  const cases = [
    { name: 'A paths -> .d.ts stub', dir: project(root, 'a', { 'src/domain/user.ts': ENTITY, 'vendor/typeorm.d.ts': STUB_DTS }, alias, ['src/**/*.ts', 'vendor/**/*.d.ts']), file: 'src/domain/user.ts' },
    { name: 'B paths -> .ts stub', dir: project(root, 'b', { 'src/domain/user.ts': ENTITY, 'vendor/typeorm.ts': STUB_TS }, alias, ['src/**/*.ts', 'vendor/**/*.ts']), file: 'src/domain/user.ts' },
    { name: 'C ambient declare module', dir: project(root, 'c', { 'src/domain/user.ts': ENTITY, 'types/vendor.d.ts': AMBIENT }, {}, ['src/**/*.ts', 'types/**/*.d.ts']), file: 'src/domain/user.ts' },
    { name: 'D antipattern-nest fixture', dir: path.join(repoRoot, 'fixtures/unit/antipattern-nest'), file: 'src/invoice/invoice.entity.ts' },
  ];
  for (const c of cases) {
    const r = await extractAPG(c.dir, V13_DEFAULT_OPTIONS);
    if (!r.success) {
      process.stdout.write(`${c.name}: extraction failed\n`);
      continue;
    }
    const g: APGResult = r.data;
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const file = g.nodes.find((n) => n.type === 'File' && n.filePath === c.file);
    const imports = g.edges
      .filter((e) => e.type === 'IMPORTS' && e.sourceId === file?.id)
      .map((e) => {
        const t = byId.get(e.targetId);
        return t === undefined ? '?' : `${t.type}:${t.type === 'Package' ? t.name : t.filePath}`;
      });
    const packages = g.nodes.filter((n) => n.type === 'Package').map((n) => n.name);
    const warnings = g.warnings.filter((w) => JSON.stringify(w).includes(c.file)).map((w) => `${w.code} ${w.message}`);
    process.stdout.write(`${c.name}\n  IMPORTS from ${c.file}: ${JSON.stringify(imports)}\n  Package nodes: ${JSON.stringify(packages)}\n  warnings on the file: ${JSON.stringify(warnings)}\n`);
  }
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch2-ffp01-repro.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
