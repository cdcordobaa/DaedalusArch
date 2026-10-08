/**
 * Stub provisioning (U5a plan Step 11; Q2; ADR-015 item 7; BR-U5a-10 (a)–(d)).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { copyBase, prepareFixtureBase } from '../../../../scripts/lib/mutation/prepare.js';
import {
  collectImportUses,
  isBareSpecifier,
  packageNameOf,
  provisionStubs,
  stubContent,
} from '../../../../scripts/lib/mutation/stubs.js';
import type { ImportUse } from '../../../../scripts/lib/mutation/stubs.js';
import { typecheckProject } from '../../../../scripts/lib/mutation/typecheck.js';
import type { PreparedBase } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const TASK = 'src/domain/entities/Task.ts';
const runner = new NodeProcessRunner();

let scratch: string;
let base: PreparedBase;
beforeAll(async () => {
  const r = await prepareFixtureBase(runner, REPO, 'fixtures/correct-reference', 'specs/clean-arch.yaml');
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  base = r.data;
});
beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-stubs-'));
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

const TSCONFIG = '{"compilerOptions":{"target":"ES2022","module":"CommonJS","moduleResolution":"node","strict":true,"skipLibCheck":true},"include":["src/**/*.ts"]}';

async function crCopy(name: string): Promise<string> {
  const c = await copyBase(base, path.join(scratch, name));
  if (!c.success) throw new Error('copy');
  return c.data;
}

describe('BR-U5a-10 (a) never over a package', () => {
  it('a base with node_modules/@nestjs/common/package.json gets no stub; bytes unchanged', () => {
    const root = path.join(scratch, 'nest');
    write(root, 'tsconfig.json', TSCONFIG);
    write(root, 'src/app.ts', "import { Injectable } from '@nestjs/common';\nexport const i = Injectable;\n");
    const pkgJson = '{"name":"@nestjs/common","version":"10.0.0"}\n';
    write(root, 'node_modules/@nestjs/common/package.json', pkgJson);
    const uses = collectImportUses(root, 'tsconfig.json');
    if (!uses.success) throw new Error('uses');
    expect(uses.data).toEqual([{ specifier: '@nestjs/common', fromFile: 'src/app.ts', form: 'named', name: 'Injectable' }]);
    const r = provisionStubs(root, 'tsconfig.json', uses.data);
    expect(r.success && r.data).toEqual([]);
    expect(fs.readFileSync(path.join(root, 'node_modules/@nestjs/common/package.json'), 'utf8')).toBe(pkgJson);
    expect(fs.readdirSync(path.join(root, 'node_modules/@nestjs/common'))).toEqual(['package.json']);
  });

  it('a package directory in an ancestor node_modules (monorepo root) also blocks the stub', () => {
    const mono = path.join(scratch, 'mono');
    write(mono, 'node_modules/express/package.json', '{"name":"express"}\n');
    const root = path.join(mono, 'apps/api');
    write(root, 'tsconfig.json', TSCONFIG);
    write(root, 'src/a.ts', "import express from 'express';\nexport const e = express;\n");
    const uses = collectImportUses(root, 'tsconfig.json');
    if (!uses.success) throw new Error('uses');
    const r = provisionStubs(root, 'tsconfig.json', uses.data);
    expect(r.success && r.data).toEqual([]);
    expect(fs.existsSync(path.join(root, 'node_modules'))).toBe(false);
  });

  it('a resolvable specifier gets no stub', () => {
    const root = path.join(scratch, 'ok');
    write(root, 'tsconfig.json', TSCONFIG);
    write(root, 'src/a.ts', "import { x } from 'lib';\nexport const y = x;\n");
    write(root, 'node_modules/lib/package.json', '{"name":"lib","types":"index.d.ts"}\n');
    write(root, 'node_modules/lib/index.d.ts', 'export declare const x: number;\n');
    const r = provisionStubs(root, 'tsconfig.json', [{ specifier: 'lib', fromFile: 'src/a.ts', form: 'named', name: 'x' }]);
    expect(r.success && r.data).toEqual([]);
  });
});

describe('BR-U5a-10 (b) failed resolution of express in correct-reference', () => {
  it('writes a default-export stub, recorded, and MO-P01-style import type-checks with the repo tsc', async () => {
    const copy = await crCopy('cr');
    const baseUses = collectImportUses(copy, 'tsconfig.json');
    if (!baseUses.success) throw new Error('uses');
    expect(baseUses.data).toEqual([]);
    const op: ImportUse = { specifier: 'express', fromFile: TASK, form: 'default' };
    const r = provisionStubs(copy, 'tsconfig.json', [...baseUses.data, op]);
    expect(r.success && r.data).toEqual([{ specifier: 'express', path: 'node_modules/express' }]);
    const dts = fs.readFileSync(path.join(copy, 'node_modules/express/index.d.ts'), 'utf8');
    expect(dts).toContain('export default _default');
    expect(JSON.parse(fs.readFileSync(path.join(copy, 'node_modules/express/package.json'), 'utf8'))).toMatchObject({ types: 'index.d.ts' });
    const task = path.join(copy, TASK);
    fs.writeFileSync(task, `import express from 'express';\n${fs.readFileSync(task, 'utf8')}\nexport const http = express;\n`);
    const tc = await typecheckProject(runner, base.tscPath, path.join(copy, 'tsconfig.json'));
    expect(tc.success && tc.data.errors).toEqual([]);
  }, 60_000);

  it('without the stub the same edit fails with TS2307 (the stub is what makes it type-check)', async () => {
    const copy = await crCopy('nostub');
    const task = path.join(copy, TASK);
    fs.writeFileSync(task, `import express from 'express';\n${fs.readFileSync(task, 'utf8')}\nexport const http = express;\n`);
    const tc = await typecheckProject(runner, base.tscPath, path.join(copy, 'tsconfig.json'));
    expect(tc.success && tc.data.errors.map((e) => e.code)).toEqual(['TS2307']);
  }, 60_000);
});

describe('BR-U5a-10 (c) parity', () => {
  it('the baseline copy and the mutant copy get byte-identical stubs', async () => {
    const uses: ImportUse[] = [
      { specifier: 'express', fromFile: TASK, form: 'default' },
      { specifier: 'express', fromFile: TASK, form: 'named', name: 'Router' },
    ];
    const baseline = await crCopy('baseline');
    const mutant = await crCopy('mutant');
    const r1 = provisionStubs(baseline, 'tsconfig.json', uses);
    const r2 = provisionStubs(mutant, 'tsconfig.json', [...uses].reverse());
    expect(r1).toEqual(r2);
    for (const f of ['package.json', 'index.d.ts']) {
      expect(fs.readFileSync(path.join(mutant, 'node_modules/express', f))).toEqual(fs.readFileSync(path.join(baseline, 'node_modules/express', f)));
    }
  });
});

describe('BR-U5a-10 (d) stub content', () => {
  const u = (form: ImportUse['form'], name?: string): ImportUse => ({ specifier: 'express', fromFile: 'a.ts', form, ...(name !== undefined ? { name } : {}) });

  it('named { Router } → export declare const Router: any;', () => {
    expect(stubContent([u('named', 'Router')])).toBe('export declare const Router: any;\n');
  });

  it('class used with new/extends, default, sorted output, namespace-only and mixed forms', () => {
    expect(stubContent([u('named', 'B'), u('named-class', 'A'), u('default'), u('named', 'A')])).toBe(
      'export declare class A { [key: string]: any; constructor(...args: any[]); }\nexport declare const B: any;\ndeclare const _default: any;\nexport default _default;\n',
    );
    expect(stubContent([u('namespace')])).toBe('declare const _ns: any;\nexport = _ns;\n');
    expect(stubContent([u('namespace'), u('named', 'X')])).toBe('export declare const X: any;\n');
    expect(stubContent([u('default'), u('named', 'B'), u('named', 'A')])).toBe(stubContent([u('named', 'A'), u('named', 'B'), u('default')]));
  });

  it('collects forms from a base: default, named, class use, namespace, import-equals; relative and node: ignored', () => {
    const root = path.join(scratch, 'forms');
    write(root, 'tsconfig.json', TSCONFIG);
    write(
      root,
      'src/a.ts',
      [
        "import def, { Router, Base as B2 } from 'express';",
        "import * as ns from 'ns-only';",
        "import req = require('req-only');",
        "import { local } from './local';",
        "import * as fsx from 'node:fs';",
        'class C extends B2 {}',
        'export const all = [def, Router, ns, req, local, fsx, new C()];',
        '',
      ].join('\n'),
    );
    write(root, 'src/local.ts', 'export const local = 1;\n');
    const r = collectImportUses(root, 'tsconfig.json');
    expect(r.success && r.data).toEqual([
      { specifier: 'express', fromFile: 'src/a.ts', form: 'default' },
      { specifier: 'express', fromFile: 'src/a.ts', form: 'named', name: 'Router' },
      { specifier: 'express', fromFile: 'src/a.ts', form: 'named-class', name: 'Base' },
      { specifier: 'ns-only', fromFile: 'src/a.ts', form: 'namespace' },
      { specifier: 'req-only', fromFile: 'src/a.ts', form: 'namespace' },
    ]);
    if (!r.success) throw new Error('uses');
    const stubs = provisionStubs(root, 'tsconfig.json', r.data);
    expect(stubs.success && stubs.data.map((s) => s.specifier)).toEqual(['express', 'ns-only', 'req-only']);
    expect(fs.readFileSync(path.join(root, 'node_modules/req-only/index.d.ts'), 'utf8')).toBe('declare const _ns: any;\nexport = _ns;\n');
  });

  it('specifier helpers', () => {
    expect(packageNameOf('@nestjs/common/http')).toBe('@nestjs/common');
    expect(packageNameOf('lodash/fp')).toBe('lodash');
    expect(['express', './x', '/abs', 'node:fs', ''].map(isBareSpecifier)).toEqual([true, false, false, false, false]);
  });
});
