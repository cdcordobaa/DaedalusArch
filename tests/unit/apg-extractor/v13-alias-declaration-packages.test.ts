/**
 * v1.3 F-P01-ALIAS fix (`ExtractorOptions.aliasDeclarationPackages`; Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md
 * §4). A bare specifier that tsconfig `paths` maps to a local declaration stub is a Package import under the v1.3
 * defaults, so FF-P01 domain-purity sees it; under the v1.2E defaults it is dropped with EXTRACTOR_008, as before.
 * The four project shapes are those of `scripts/v1.3/judge-catch2-ffp01-repro.ts`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { DEFAULT_OPTIONS, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import { memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { v13DomainPurity } from '../../../src/fitness-compiler/v13-in-memory-baselines.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const ENTITY = "import { Column, Entity } from 'typeorm';\n\n@Entity()\nexport class User {\n  @Column()\n  name = '';\n}\n";
const STUB_DTS = 'export declare function Entity(): ClassDecorator;\nexport declare function Column(): PropertyDecorator;\n';
const STUB_TS = 'export function Entity(): ClassDecorator { return () => undefined; }\nexport function Column(): PropertyDecorator { return () => undefined; }\n';
const AMBIENT = "declare module 'typeorm' {\n  export function Entity(): ClassDecorator;\n  export function Column(): PropertyDecorator;\n}\n";
const OPTIONS = { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, experimentalDecorators: true, skipLibCheck: true, noEmit: true };
const ALIAS = { baseUrl: '.', paths: { typeorm: ['vendor/typeorm'] } };

const layerModel = (dir: string): LayerModel => ({
  layers: [{ name: 'domain', directories: [dir], naming: [], role: '', kind: 'domain', kindSource: 'explicit' }],
});

let root: string;
function project(name: string, files: Record<string, string>, extra: Record<string, unknown>, include: string[]): string {
  const dir = path.join(root, name);
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { ...OPTIONS, ...extra }, include }, null, 2));
  return dir;
}

async function extract(dir: string, opts: object): Promise<APGResult> {
  const r = await extractAPG(dir, opts);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

function importsOf(g: APGResult, file: string): string[] {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const f = g.nodes.find((n) => n.type === 'File' && n.filePath === file);
  return g.edges.filter((e) => e.type === 'IMPORTS' && e.sourceId === f?.id).map((e) => {
    const t = byId.get(e.targetId);
    return t === undefined ? '?' : `${t.type}:${t.type === 'Package' ? t.name : t.filePath}`;
  });
}

const purity = (g: APGResult, dir: string, forbidden: string[]): string[] =>
  v13DomainPurity(memGraph(g, layerModel(dir)), 'domain', forbidden).map((r) => `${String(r['source'])} -> ${String(r['target'])}`);

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-alias-dts-'));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('option defaults', () => {
  it('aliasDeclarationPackages is OFF in the v1.2E defaults and ON in the v1.3 defaults', () => {
    expect(V12E_DEFAULT_OPTIONS.aliasDeclarationPackages).toBe(false);
    expect(V13_DEFAULT_OPTIONS.aliasDeclarationPackages).toBe(true);
    expect(DEFAULT_OPTIONS.aliasDeclarationPackages).toBe(true);
  });
});

describe('shape A: paths -> local .d.ts stub (the round-2 repro)', () => {
  let dir: string;
  beforeAll(() => {
    dir = project('a', { 'src/domain/user.ts': ENTITY, 'vendor/typeorm.d.ts': STUB_DTS }, ALIAS, ['src/**/*.ts', 'vendor/**/*.d.ts']);
  });

  it('v1.3: an IMPORTS edge to Package typeorm, EXTRACTOR_008 kept as info, and FF-P01 fires', async () => {
    const g = await extract(dir, V13_DEFAULT_OPTIONS);
    expect(importsOf(g, 'src/domain/user.ts')).toEqual(['Package:typeorm']);
    expect(g.nodes.filter((n) => n.type === 'Package').map((n) => n.name)).toEqual(['typeorm']);
    const w = g.warnings.filter((x) => x.filePath === 'src/domain/user.ts');
    expect(w).toEqual([{
      filePath: 'src/domain/user.ts', code: 'EXTRACTOR_008', severity: 'info',
      message: 'Import target outside the extracted set: typeorm (a declaration file reached through tsconfig paths; recorded as Package typeorm)',
    }]);
    expect(g.importResolution.droppedNoFileNode).toBe(0);
    expect(purity(g, 'src/domain/**', ['typeorm'])).toEqual(['src/domain/user.ts -> typeorm']);
  });

  it('v1.2E: unchanged, the import is dropped with a plain EXTRACTOR_008 and FF-P01 cannot fire', async () => {
    const g = await extract(dir, V12E_DEFAULT_OPTIONS);
    expect(importsOf(g, 'src/domain/user.ts')).toEqual([]);
    expect(g.warnings.filter((x) => x.filePath === 'src/domain/user.ts'))
      .toEqual([{ filePath: 'src/domain/user.ts', code: 'EXTRACTOR_008', message: 'Import target outside the extracted set: typeorm' }]);
    expect(purity(g, 'src/domain/**', ['typeorm'])).toEqual([]);
  });

  it('v1.3 with the option turned off behaves as v1.2E', async () => {
    const g = await extract(dir, { ...V13_DEFAULT_OPTIONS, aliasDeclarationPackages: false });
    expect(importsOf(g, 'src/domain/user.ts')).toEqual([]);
  });
});

describe('the other shapes are unchanged', () => {
  it('shape B (paths -> a .ts stub with a File node): still a File edge', async () => {
    const dir = project('b', { 'src/domain/user.ts': ENTITY, 'vendor/typeorm.ts': STUB_TS }, ALIAS, ['src/**/*.ts', 'vendor/**/*.ts']);
    const g = await extract(dir, V13_DEFAULT_OPTIONS);
    expect(importsOf(g, 'src/domain/user.ts')).toEqual(['File:vendor/typeorm.ts']);
  });

  it('shape C (ambient declare module): a Package edge in both instruments', async () => {
    const dir = project('c', { 'src/domain/user.ts': ENTITY, 'types/vendor.d.ts': AMBIENT }, {}, ['src/**/*.ts', 'types/**/*.d.ts']);
    expect(importsOf(await extract(dir, V13_DEFAULT_OPTIONS), 'src/domain/user.ts')).toEqual(['Package:typeorm']);
    expect(importsOf(await extract(dir, V12E_DEFAULT_OPTIONS), 'src/domain/user.ts')).toEqual(['Package:typeorm']);
  });

  it('a relative import of a local .d.ts is still outside the extracted set (not a package)', async () => {
    const dir = project('rel', { 'src/domain/user.ts': "import type { T } from './types';\nexport const x: T | undefined = undefined;\n", 'src/domain/types.d.ts': 'export type T = string;\n' }, {}, ['src/**/*.ts']);
    const g = await extract(dir, V13_DEFAULT_OPTIONS);
    expect(importsOf(g, 'src/domain/user.ts')).toEqual([]);
    expect(g.warnings.filter((x) => x.filePath === 'src/domain/user.ts').map((x) => [x.code, x.severity])).toEqual([['EXTRACTOR_008', undefined]]);
  });
});

describe('shape D: fixtures/unit/antipattern-nest (round 1 AP-PERSIST-IN-DOMAIN)', () => {
  const dir = path.join(REPO_ROOT, 'fixtures/unit/antipattern-nest');
  const file = 'src/invoice/invoice.entity.ts';

  it('v1.3: the entity imports Package typeorm and FF-P01 (typeorm forbidden in the entity) fires', async () => {
    const g = await extract(dir, V13_DEFAULT_OPTIONS);
    expect(importsOf(g, file)).toEqual(['Package:typeorm']);
    expect(purity(g, 'src/invoice/invoice.entity.ts', ['typeorm'])).toEqual([`${file} -> typeorm`]);
  });

  it('v1.2E: the import is still dropped', async () => {
    const g = await extract(dir, V12E_DEFAULT_OPTIONS);
    expect(importsOf(g, file)).toEqual([]);
    expect(purity(g, 'src/invoice/invoice.entity.ts', ['typeorm'])).toEqual([]);
  });
});
