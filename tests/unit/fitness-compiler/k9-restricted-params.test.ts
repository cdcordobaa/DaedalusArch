/**
 * K9 (FR-19, NFR-02; BR-U1-33, BR-U1-37): `$applicationLayers` list and restricted parameter maps.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';

const ROOT = path.resolve(__dirname, '../../..');
const SHIPPED = ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'specs/daedalus-arch.yaml', 'specs/clean-arch.yaml'];

/** `$name` tokens of a Cypher text, with block/line comments and string literals skipped. */
function paramTokens(cypher: string): Set<string> {
  const stripped = cypher
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return new Set([...stripped.matchAll(/\$(\w+)/g)].map((m) => m[1] ?? ''));
}

function declared(name: string): Set<string> {
  const t = CYPHER_TEMPLATES.get(name);
  if (!t) throw new Error(`no template ${name}`);
  return new Set([...t.requiredParams, ...t.optionalParams, 'excludePatterns']);
}

describe('BR-U1-33: $name tokens are declared', () => {
  it.each([...CYPHER_TEMPLATES.keys()])('%s', (name) => {
    const t = CYPHER_TEMPLATES.get(name);
    if (!t) throw new Error(`no template ${name}`);
    const allowed = declared(name);
    expect([...paramTokens(t.template)].filter((p) => !allowed.has(p))).toEqual([]);
  });

  it('the token scan skips comments and string literals', () => {
    expect([...paramTokens("MATCH (n) /* $a */ WHERE n.x = '$b' AND n.y = $c // $d\nRETURN n")]).toEqual(['c']);
  });
});

describe('BR-U1-33: compiled parameter maps are restricted (shipped specs)', () => {
  it.each(SHIPPED)('%s: keys ⊆ declared set, required first in declared order, no outerLayers/innerLayers', async (rel) => {
    const parsed = await parseSpec({ specFilePath: path.join(ROOT, rel) });
    if (!parsed.success) throw new Error(`${rel} did not parse`);
    const compiled = compileFunctions(compilerInputFromSpec(parsed.data));
    if (!compiled.success) throw new Error(`${rel} did not compile`);
    const queries = [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)]
      .filter((q) => q.source === 'template');
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      const t = CYPHER_TEMPLATES.get(q.name);
      if (!t) throw new Error(`no template ${q.name}`);
      const keys = Object.keys(q.params);
      const allowed = declared(q.name);
      expect({ id: String(q.functionId), extra: keys.filter((k) => !allowed.has(k)) }).toEqual({ id: String(q.functionId), extra: [] });
      const order = [...new Set([...t.requiredParams, ...t.optionalParams])].filter((k) => keys.includes(k));
      const expected = keys.includes('excludePatterns') ? [...order, 'excludePatterns'] : order;
      expect({ id: String(q.functionId), keys }).toEqual({ id: String(q.functionId), keys: expected });
      expect(keys).not.toContain('outerLayers');
      expect(keys).not.toContain('innerLayers');
      expect(keys).not.toContain('applicationLayer');
    }
  });
});

describe('BR-U1-37: $applicationLayers list', () => {
  it("(a) no '$applicationLayer' scalar token remains in cypher-templates.ts", () => {
    const text = fs.readFileSync(path.join(ROOT, 'src/fitness-compiler/cypher-templates.ts'), 'utf8');
    expect(text.match(/\$applicationLayer\b/g)).toBeNull();
  });

  it.each(['dependency-inversion', 'use-case-isolation', 'naming-conventions', 'naming-services'])(
    '%s requires applicationLayers and matches with IN',
    (name) => {
      const t = CYPHER_TEMPLATES.get(name);
      if (!t) throw new Error(`no template ${name}`);
      expect(t.requiredParams).toContain('applicationLayers');
      expect(t.requiredParams).not.toContain('applicationLayer');
      expect(t.template).toMatch(/\.layer IN \$applicationLayers/);
    },
  );

  it('use-case-isolation excludes application dependencies with NOT … IN', () => {
    expect(CYPHER_TEMPLATES.get('use-case-isolation')?.template).toContain('NOT dep.layer IN $applicationLayers');
  });

  it('binds every application layer of a two-application-layer model as a list', async () => {
    const parsed = await parseSpec({ specFilePath: path.join(ROOT, 'specs/clean-arch.yaml') });
    if (!parsed.success) throw new Error('did not parse');
    const input = compilerInputFromSpec(parsed.data);
    const layers = input.layerModel.layers.flatMap((l) =>
      (l.kind === 'application' ? [l, { ...l, name: 'application-2', directories: ['src/app2/**'] }] : [l]));
    const compiled = compileFunctions({ ...input, layerModel: { ...input.layerModel, layers } });
    if (!compiled.success) throw new Error(`did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
    const di = compiled.data.symbolicQueries.find((q) => q.name === 'dependency-inversion');
    expect(di?.params.applicationLayers).toEqual(['application', 'application-2']);
  });
});
