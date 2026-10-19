/**
 * v1.3 extractor fixes N33 and N38 (Docs/DiagnosticRuns/v1.3-extractor-fixes-n33-n38-2026-10-18.md).
 *
 * N33: a tsconfig `paths` alias whose first segment is a Node built-in name (`domain/*` in msc29-clean) was classified
 * as the built-in before TypeScript resolution ran, so every `domain/...` import became Package `domain`. TypeScript
 * applies `paths` and `baseUrl` first; the extractor now does the same when the specifier has no `node:` prefix.
 *
 * N38: under `strictNullChecks` the type of an optional constructor parameter `x?: T` is the union `T | undefined`,
 * which has no symbol, so no CONSTRUCTOR_INJECTS edge was written. The nullable members are now stripped first.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { DEFAULT_OPTIONS, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import type { APGResult } from '../../../src/shared/types/apg.js';

const BASE = { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, skipLibCheck: true, noEmit: true };

let root: string;
function project(name: string, files: Record<string, string>, compilerOptions: Record<string, unknown>): string {
  const dir = path.join(root, name);
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { ...BASE, ...compilerOptions }, include: ['src/**/*.ts'] }, null, 2));
  return dir;
}

async function extract(dir: string, opts: object = V13_DEFAULT_OPTIONS): Promise<APGResult> {
  const r = await extractAPG(dir, opts);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

function importsOf(g: APGResult, file: string): string[] {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const f = g.nodes.find((n) => n.type === 'File' && n.filePath === file);
  return g.edges.filter((e) => e.type === 'IMPORTS' && e.sourceId === f?.id).map((e) => {
    const t = byId.get(e.targetId);
    if (t === undefined) return '?';
    return t.type === 'Package' ? `Package:${t.name}:${JSON.stringify(t.properties.scope ?? '')}` : `${t.type}:${t.filePath}`;
  }).sort();
}

function injectsOf(g: APGResult, className: string): string[] {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const c = g.nodes.find((n) => n.type === 'Class' && n.name === className);
  return g.edges.filter((e) => e.type === 'CONSTRUCTOR_INJECTS' && e.sourceId === c?.id)
    .map((e) => `${JSON.stringify(e.properties.parameterName ?? '')}->${byId.get(e.targetId)?.name ?? '?'}`).sort();
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-n33-n38-'));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('option defaults', () => {
  it('aliasShadowsBuiltins and nullableInjects are OFF in the frozen v1.2E defaults and ON in the v1.3 defaults', () => {
    expect([V12E_DEFAULT_OPTIONS.aliasShadowsBuiltins, V12E_DEFAULT_OPTIONS.nullableInjects]).toEqual([false, false]);
    expect([V13_DEFAULT_OPTIONS.aliasShadowsBuiltins, V13_DEFAULT_OPTIONS.nullableInjects]).toEqual([true, true]);
    expect([DEFAULT_OPTIONS.aliasShadowsBuiltins, DEFAULT_OPTIONS.nullableInjects]).toEqual([true, true]);
  });
});

describe('N33: a paths alias named like a Node built-in (msc29-clean shape)', () => {
  const MSC29_PATHS = {
    baseUrl: '.',
    paths: { '*': ['src/*'], 'domain/*': ['src/domain/*'], 'application/*': ['src/application/*'] },
  };
  let g: APGResult;
  beforeAll(async () => {
    const dir = project('n33', {
      'src/domain/entities/cat.ts': 'export class Cat { constructor(readonly name: string) {} }\n',
      'src/application/mappers/cat.mapper.ts': "import { Cat } from 'domain/entities/cat';\nexport const toName = (c: Cat): string => c.name;\n",
      'src/application/usecases/get-cat.ts': [
        "import { Cat } from 'domain/entities/cat';",
        "import { toName } from 'application/mappers/cat.mapper';",
        "import { EventEmitter } from 'events';",
        "import * as fsp from 'node:fs/promises';",
        "import * as d from 'domain';",
        'export const run = (c: Cat): [string, unknown, unknown, unknown] => [toName(c), EventEmitter, fsp, d];',
        '',
      ].join('\n'),
    }, { ...MSC29_PATHS, strict: true });
    g = await extract(dir);
  });

  it('domain/... resolves to the project file, as tsc does', () => {
    expect(importsOf(g, 'src/application/mappers/cat.mapper.ts')).toEqual(['File:src/domain/entities/cat.ts']);
  });

  it('application/... still resolves, and real built-ins stay built-in Packages', () => {
    expect(importsOf(g, 'src/application/usecases/get-cat.ts')).toEqual([
      'File:src/application/mappers/cat.mapper.ts',
      'File:src/domain/entities/cat.ts',
      'Package:domain:"node"',
      'Package:events:"node"',
      'Package:fs:"node"',
    ]);
  });

  it('aliasShadowsBuiltins off (v1.2E): the alias is the built-in Package, as before', async () => {
    const off = await extract(path.join(root, 'n33'), { ...V13_DEFAULT_OPTIONS, aliasShadowsBuiltins: false });
    expect(importsOf(off, 'src/application/mappers/cat.mapper.ts')).toEqual(['Package:domain:"node"']);
  });

  it('only the bare `domain` import is a Package named domain', () => {
    const domainPkgs = g.nodes.filter((n) => n.type === 'Package' && n.name === 'domain');
    // Only the bare `domain` import (no local src/domain/index.ts) is the built-in.
    expect(domainPkgs.map((n) => n.name)).toEqual(['domain']);
  });
});

describe('N38: optional constructor parameters under strictNullChecks', () => {
  const FILES = {
    'src/infra/repo.ts': 'export class Repo { save(): void {} }\n',
    'src/infra/clock.ts': 'export class Clock { now(): number { return 0; } }\n',
    'src/infra/bus.ts': 'export class Bus { emit(): void {} }\n',
    'src/infra/other.ts': 'export class Other { x = 1; }\n',
    'src/domain/service.ts': [
      "import { Repo } from '../infra/repo';",
      "import { Clock } from '../infra/clock';",
      "import { Bus } from '../infra/bus';",
      "import { Other } from '../infra/other';",
      'export class Service {',
      '  constructor(',
      '    private readonly repo?: Repo,',
      '    private readonly clock: Clock | null = null,',
      '    private readonly bus: Bus | undefined = undefined,',
      '    private readonly either?: Repo | Other,',
      '  ) {}',
      '}',
      '',
    ].join('\n'),
  };

  for (const [name, opts] of [['strict', { strict: true }], ['strictNullChecks', { strictNullChecks: true }]] as const) {
    it(`${name}: optional and nullable parameters inject their class; a real union does not`, async () => {
      const g = await extract(project(`n38-${name}`, FILES, opts));
      expect(injectsOf(g, 'Service')).toEqual(['"bus"->Bus', '"clock"->Clock', '"repo"->Repo']);
    });
  }

  it('nullableInjects off (v1.2E): no edge under strict, as before', async () => {
    const g = await extract(path.join(root, 'n38-strict'), { ...V13_DEFAULT_OPTIONS, nullableInjects: false });
    expect(injectsOf(g, 'Service')).toEqual([]);
  });

  it('null checks off: the same edges (control, unchanged behaviour)', async () => {
    const g = await extract(project('n38-off', FILES, { strict: false }));
    expect(injectsOf(g, 'Service')).toEqual(['"bus"->Bus', '"clock"->Clock', '"repo"->Repo']);
  });
});

describe('N38 does not explain the AP-FRAMEWORK-LEAK seeds (NS-01 §3)', () => {
  it('an optional express `Request` method parameter keeps its IMPORTS edge to Package express under strict', async () => {
    const dir = project('n38-framework-leak', {
      'src/application/order.service.ts': [
        "import { Request } from 'express';",
        'export class OrderService {',
        '  create(quantity: number, request?: Request): number { return quantity; }',
        '}',
        '',
      ].join('\n'),
    }, { strict: true });
    const g = await extract(dir);
    expect(importsOf(g, 'src/application/order.service.ts')).toEqual(['Package:express:"npm"']);
    // A method parameter is never CONSTRUCTOR_INJECTS: the seed is visible as an import, which no rule scopes there.
    expect(injectsOf(g, 'OrderService')).toEqual([]);
  });
});

describe('N32 (felixle-node-core shape): baseUrl ./src, no paths', () => {
  it('domain/... resolves to the project file', async () => {
    const dir = project('n32', {
      'src/domain/entities/auth/Auth.ts': 'export class Auth { id = 1; }\n',
      'src/application/repo.ts': "import { Auth } from 'domain/entities/auth/Auth';\nexport interface IAuthRepository { get(): Auth; }\n",
    }, { baseUrl: './src', strict: true });
    const g = await extract(dir);
    expect(importsOf(g, 'src/application/repo.ts')).toEqual(['File:src/domain/entities/auth/Auth.ts']);
  });
});
