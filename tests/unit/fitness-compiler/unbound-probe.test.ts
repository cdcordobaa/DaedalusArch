/**
 * Unbound-parameter probe over the four shipped specs (BR-U1-03 a, BR-U1-09 d, BR-U1-16 a).
 * Functions disabled by kind or style are listed as disabled with a reason, never as unbound.
 */
import * as path from 'node:path';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { findUnboundParameters } from '../../../src/fitness-compiler/bound-param-checker.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';
import { reenableAdr016b } from './adr016b.js';

const ROOT = path.resolve(__dirname, '../../..');
const SHIPPED = ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'specs/daedalus-arch.yaml', 'specs/clean-arch.yaml'];

async function load(rel: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!r.success) throw new Error(`${rel} did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return reenableAdr016b(r.data); // ADR-016 b exclusions re-enabled for the binding mechanism (adr016b.ts)
}

function compile(spec: ParsedSpec): CompiledFunctions {
  const r = compileFunctions(compilerInputFromSpec(spec));
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function symbolicIds(c: CompiledFunctions): string[] {
  return [...c.symbolicQueries.map((q) => String(q.functionId)), ...c.hybridPairs.map((h) => String(h.functionId))];
}

describe.each(SHIPPED)('probe %s', (rel) => {
  it('0 unbound required parameters', async () => {
    expect(findUnboundParameters(compilerInputFromSpec(await load(rel)))).toEqual([]);
  });

  it('every enabled templated symbolic/hybrid function is compiled or disabled with a reason', async () => {
    const spec = await load(rel);
    const c = compile(spec);
    const compiled = new Set(symbolicIds(c));
    for (const d of c.disabledFunctions) {
      expect({ id: d.id, reason: typeof d.reason === 'string' && d.reason.length > 0 }).toEqual({ id: d.id, reason: true });
      expect(compiled.has(String(d.id))).toBe(false);
    }
    const disabled = new Set(c.disabledFunctions.map((d) => String(d.id)));
    const expected = spec.fitnessFunctions
      .filter((f) => f.enabled && f.route !== 'neuronal' && CYPHER_TEMPLATES.has(f.name))
      .map((f) => String(f.id));
    for (const id of expected) expect({ id, covered: compiled.has(id) || disabled.has(id) }).toEqual({ id, covered: true });
  });

  it('every compiled query binds each of its template required parameters', async () => {
    const c = compile(await load(rel));
    const queries = [...c.symbolicQueries, ...c.hybridPairs.map((h) => h.symbolicQuery)];
    for (const q of queries) {
      const t = CYPHER_TEMPLATES.get(q.name);
      for (const p of t?.requiredParams ?? []) {
        expect({ id: q.functionId, p, bound: q.params[p] != null }).toEqual({ id: q.functionId, p, bound: true });
      }
    }
  });
});

describe('self-spec (BR-U1-16 a)', () => {
  it('infraLayer = core-modules; FF-P03, FF-P05, FF-CV01, FF-CV04 compile; FF-C03 threshold 0.8', async () => {
    const c = compile(await load('specs/daedalus-arch.yaml'));
    // FF-P05 and FF-CV04 bind core-modules through $controllerLayer from K16 (no presentation layer; BR-U1-46).
    for (const [id, param] of [['FF-P03', 'infraLayer'], ['FF-P05', 'controllerLayer'], ['FF-CV01', 'infraLayer'], ['FF-CV04', 'controllerLayer']] as const) {
      expect(c.symbolicQueries.find((q) => String(q.functionId) === id)?.params[param]).toBe('core-modules');
    }
    expect(c.symbolicQueries.find((q) => String(q.functionId) === 'FF-C03')).toMatchObject({ params: { threshold: 0.8 } });
  });
});
