import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  NODE_BUILTIN_MODULES,
  PackageNodeRegistry,
  builtinRoot,
  isBuiltinSpecifier,
  packageRootFromAliasKey,
  packageRootFromBaseUrlSpecifier,
  packageRootFromNodeModulesPath,
  packageRootFromSpecifier,
} from '../../../src/apg-extractor/package-node-factory.js';
import * as extractorIndex from '../../../src/apg-extractor/index.js';
import { generateNodeId } from '../../../src/apg-extractor/id-generator.js';

const FACTORY_SOURCE = resolve(__dirname, '../../../src/apg-extractor/package-node-factory.ts');

describe('package-node-factory', () => {
  describe('built-ins (BR-U2-03, 04)', () => {
    it('maps node:fs, fs and fs/promises to one Package fs with scope node', () => {
      const registry = new PackageNodeRegistry();
      const specs = ['node:fs', 'fs', 'fs/promises'];
      for (const s of specs) {
        expect(isBuiltinSpecifier(s)).toBe(true);
        registry.getOrCreate(builtinRoot(s));
      }
      const nodes = registry.nodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toEqual({
        id: generateNodeId('Package', '', 'fs'),
        type: 'Package',
        name: 'fs',
        filePath: '',
        decorators: [],
        properties: { scope: 'node' },
      });
    });

    it('strips node: and takes the first segment', () => {
      expect(builtinRoot('node:fs/promises')).toEqual({ name: 'fs', scope: 'node' });
      expect(builtinRoot('node:test')).toEqual({ name: 'test', scope: 'node' });
    });

    it('does not treat node:-only names or non-built-ins as built-in without the prefix', () => {
      expect(isBuiltinSpecifier('test/factories/app')).toBe(false);
      expect(isBuiltinSpecifier('express')).toBe(false);
      expect(isBuiltinSpecifier('./fs')).toBe(false);
      expect(isBuiltinSpecifier('node:test')).toBe(true);
    });

    it('lets the built-in punycode win and never changes an existing scope', () => {
      expect(isBuiltinSpecifier('punycode')).toBe(true);
      const registry = new PackageNodeRegistry();
      const first = registry.getOrCreate(builtinRoot('punycode'));
      expect(first.properties).toEqual({ scope: 'node' });
      const second = registry.getOrCreate({ name: 'punycode', scope: 'npm' });
      expect(second).toBe(first);
      expect(second.properties).toEqual({ scope: 'node' });
      expect(registry.nodes()).toHaveLength(1);
    });

    it('pins the list as a frozen literal, not computed at runtime', () => {
      expect(Object.isFrozen(NODE_BUILTIN_MODULES)).toBe(true);
      expect(NODE_BUILTIN_MODULES).toHaveLength(54);
      expect(NODE_BUILTIN_MODULES.some(m => m.startsWith('_') || m.startsWith('node:'))).toBe(false);
      const code = readFileSync(FACTORY_SOURCE, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/builtinModules/);
      expect(code).not.toMatch(/\bisBuiltin\(/);
      expect(code).not.toMatch(/from ['"](node:)?module['"]/);
      expect(code).not.toMatch(/require\(['"](node:)?module['"]\)/);
    });
  });

  describe('package-shaped specifiers (BR-U2-05)', () => {
    it('names scoped packages by @scope/name with scope @scope', () => {
      expect(packageRootFromSpecifier('@nestjs/common/decorators')).toEqual({ name: '@nestjs/common', scope: '@nestjs' });
      expect(packageRootFromSpecifier('@nestjs/common')).toEqual({ name: '@nestjs/common', scope: '@nestjs' });
    });

    it('names unscoped packages by their first segment with scope npm', () => {
      expect(packageRootFromSpecifier('lodash/fp')).toEqual({ name: 'lodash', scope: 'npm' });
      expect(packageRootFromSpecifier('express')).toEqual({ name: 'express', scope: 'npm' });
    });

    it('is case-insensitive on the shape', () => {
      expect(packageRootFromSpecifier('Lodash/fp')).toEqual({ name: 'Lodash', scope: 'npm' });
    });

    it('returns undefined for roots that are not package-shaped', () => {
      expect(packageRootFromSpecifier('~/x')).toBeUndefined();
      expect(packageRootFromSpecifier('#internal/x')).toBeUndefined();
      expect(packageRootFromSpecifier('./a')).toBeUndefined();
      expect(packageRootFromSpecifier('@scope')).toBeUndefined();
    });

    it('does not take the name from a resolved @types path', () => {
      // An import of `x` that resolves to node_modules/@types/x/index.d.ts is named from the specifier.
      expect(packageRootFromSpecifier('x')).toEqual({ name: 'x', scope: 'npm' });
      // Path naming would give a different (wrong) root; it is reserved for relative specifiers.
      expect(packageRootFromNodeModulesPath('node_modules/@types/x/index.d.ts')).toEqual({ name: '@types/x', scope: '@types' });
    });
  });

  describe('relative paths into node_modules (BR-U2-09, S-4)', () => {
    it('names the package from the segment after the last node_modules/', () => {
      expect(packageRootFromNodeModulesPath('../node_modules/left-pad/index')).toEqual({ name: 'left-pad', scope: 'npm' });
      expect(packageRootFromNodeModulesPath('/p/node_modules/a/node_modules/b/lib/x.js')).toEqual({ name: 'b', scope: 'npm' });
    });

    it('takes two segments for a scoped path', () => {
      expect(packageRootFromNodeModulesPath('/p/node_modules/@scope/pkg/dist/index.d.ts')).toEqual({ name: '@scope/pkg', scope: '@scope' });
    });

    it('returns undefined without a node_modules segment', () => {
      expect(packageRootFromNodeModulesPath('/p/src/a.ts')).toBeUndefined();
      expect(packageRootFromNodeModulesPath('/p/node_modules/')).toBeUndefined();
    });
  });

  describe('alias names that are not package-shaped (BR-U2-06)', () => {
    it('strips the trailing /* from the paths key, scope npm', () => {
      expect(packageRootFromAliasKey('~/*')).toEqual({ name: '~', scope: 'npm' });
      expect(packageRootFromAliasKey('#internal/*')).toEqual({ name: '#internal', scope: 'npm' });
    });

    it('takes the first segment for a baseUrl match, scope npm', () => {
      expect(packageRootFromBaseUrlSpecifier('src/x')).toEqual({ name: 'src', scope: 'npm' });
    });
  });

  describe('PackageNodeRegistry', () => {
    it('shares one id for names that differ only in case; the first name wins', () => {
      const registry = new PackageNodeRegistry();
      const a = registry.getOrCreate({ name: 'Lodash', scope: 'npm' });
      const b = registry.getOrCreate({ name: 'lodash', scope: 'npm' });
      expect(b).toBe(a);
      expect(a.name).toBe('Lodash');
      expect(a.id).toBe(generateNodeId('Package', '', 'lodash'));
      expect(registry.nodes()).toHaveLength(1);
    });

    it('returns nodes sorted by name in code-unit order', () => {
      const registry = new PackageNodeRegistry();
      for (const name of ['zod', '@nestjs/common', 'Zeta', '~', 'express']) {
        registry.getOrCreate({ name, scope: name.startsWith('@') ? '@nestjs' : 'npm' });
      }
      expect(registry.nodes().map(n => n.name)).toEqual(['@nestjs/common', 'Zeta', 'express', 'zod', '~']);
    });

    it('is exported from the extractor index together with the pinned list', () => {
      expect(extractorIndex.PackageNodeRegistry).toBe(PackageNodeRegistry);
      expect(extractorIndex.NODE_BUILTIN_MODULES).toBe(NODE_BUILTIN_MODULES);
    });
  });
});
