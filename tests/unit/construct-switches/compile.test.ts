/**
 * The compile-time construct switches: preset additions, the nestjs layer order, applicability, carriers and the
 * composition-root excludes. The status quo compiles exactly as before, and the v1.2E compile never reads a switch.
 */
import { CONSTRUCT_ANSWERS, STATUS_QUO_ANSWERS, withAnswers } from '../../../src/shared/construct-switches.js';
import type { ConstructAnswers } from '../../../src/shared/construct-switches.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { applyConstructCompileOverlays, CONSTRUCT_CARRIER_NAME } from '../../../src/construct-switches/compile.js';
import { CONSTRUCT_COMPOSITION_ROOT_GLOBS } from '../../../src/construct-switches/overlays.js';
import { presetSpec } from './fixtures.js';

const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'] as const;

async function compiled(style: string, answers: ConstructAnswers | undefined): Promise<{ ids: string[]; disabled: string[]; cypher: Map<string, string>; params: Map<string, Record<string, unknown>> }> {
  const spec = await presetSpec(style);
  const { constructSwitches: _drop, ...v13 } = V13_COMPILE_OPTIONS;
  const r = compileFunctions(compilerInputFromSpec(spec), answers === undefined ? v13 : { ...v13, constructSwitches: answers });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return {
    ids: r.data.symbolicQueries.map((q) => String(q.functionId)),
    disabled: r.data.disabledFunctions.map((d) => String(d.id)),
    cypher: new Map(r.data.symbolicQueries.map((q) => [String(q.functionId), q.cypher])),
    params: new Map(r.data.symbolicQueries.map((q) => [String(q.functionId), q.params])),
  };
}

describe('status quo and v1.2E', () => {
  it.each(STYLES)('%s: the switch default compiles exactly as the v1.3 options without switches', async (style) => {
    const spec = await presetSpec(style);
    const { constructSwitches: _d, ...v13 } = V13_COMPILE_OPTIONS;
    const without = compileFunctions(compilerInputFromSpec(spec), v13);
    const withDefault = compileFunctions(compilerInputFromSpec(spec), V13_COMPILE_OPTIONS);
    expect(JSON.stringify(withDefault)).toBe(JSON.stringify(without));
    expect(V13_COMPILE_OPTIONS.constructSwitches).toBe(CONSTRUCT_ANSWERS);
  });

  it.each(STYLES)('%s: the v1.2E compile (no options) carries no switch: identical to the compile with {}', async (style) => {
    const spec = await presetSpec(style);
    const input = compilerInputFromSpec(spec);
    expect(JSON.stringify(compileFunctions(input))).toBe(JSON.stringify(compileFunctions(input, {})));
  });

  it('the overlays return their input at the status quo', async () => {
    const input = compilerInputFromSpec(await presetSpec('ddd'));
    expect(applyConstructCompileOverlays(input, STATUS_QUO_ANSWERS)).toBe(input);
    expect(applyConstructCompileOverlays(input, withAnswers({ Q14: 'C' }))).toBe(input);
    expect(applyConstructCompileOverlays(input, undefined)).toBe(input);
  });
});

describe('Q1 FF-P06 in layered', () => {
  it('A: disabled in layered (ADR-V13-02)', async () => {
    expect((await compiled('layered', STATUS_QUO_ANSWERS)).disabled).toContain('FF-P06');
  });
  it.each(['B', 'C'] as const)('%s: compiled in layered; other styles unchanged', async (o) => {
    const c = await compiled('layered', withAnswers({ Q1: o }));
    expect(c.ids).toContain('FF-P06');
    expect((await compiled('clean-architecture', withAnswers({ Q1: o }))).ids).toContain('FF-P06');
  });
});

describe('Q5 D adapter-isolation', () => {
  it('declares FF-S05 as a carrier in hexagonal and ddd only', async () => {
    for (const s of ['hexagonal', 'ddd']) {
      const c = await compiled(s, withAnswers({ Q5: 'D' }));
      expect(c.ids).toContain('FF-S05');
      expect(c.cypher.get('FF-S05')).toContain('WHERE false');
    }
    expect((await compiled('clean-architecture', withAnswers({ Q5: 'D' }))).ids).not.toContain('FF-S05');
  });
});

describe('Q10 FF-P01 in layered', () => {
  it.each(['C', 'D'] as const)('%s: FF-P01 disabled in layered with a reason; clean keeps it', async (o) => {
    expect((await compiled('layered', withAnswers({ Q10: o }))).disabled).toContain('FF-P01');
    expect((await compiled('clean-architecture', withAnswers({ Q10: o }))).ids).toContain('FF-P01');
  });
  it('B keeps FF-P01 compiled (its rows are narrowed by the row stage)', async () => {
    expect((await compiled('layered', withAnswers({ Q10: 'B' }))).ids).toContain('FF-P01');
  });
});

describe('Q13 C nestjs layer order', () => {
  it('compiles FF-S01 with the Clean order (infrastructure outermost); other styles keep theirs', async () => {
    expect((await compiled('nestjs', STATUS_QUO_ANSWERS)).params.get('FF-S01')?.layerOrder).toEqual(['domain', 'infrastructure', 'application', 'presentation']);
    expect((await compiled('nestjs', withAnswers({ Q13: 'C' }))).params.get('FF-S01')?.layerOrder).toEqual(['domain', 'application', 'presentation', 'infrastructure']);
    expect((await compiled('clean-architecture', withAnswers({ Q13: 'C' }))).params.get('FF-S01')?.layerOrder).toEqual(['domain', 'application', 'infrastructure']);
  });
});

describe('Q16 B FF-S02 in ddd', () => {
  it('adds no-cyclic-deps to the ddd compile', async () => {
    expect((await compiled('ddd', STATUS_QUO_ANSWERS)).ids).not.toContain('FF-S02');
    const c = await compiled('ddd', withAnswers({ Q16: 'B' }));
    expect(c.ids).toContain('FF-S02');
    expect(c.cypher.get('FF-S02')).toContain('IMPORTS|RE_EXPORTS*2..');
  });
});

describe('Q17 C FF-DS03', () => {
  it('declares FF-DS03 as a carrier in ddd', async () => {
    expect((await compiled('ddd', withAnswers({ Q17: 'C' }))).ids).toContain('FF-DS03');
  });
});

describe('Q24 B FF-S03 carrier', () => {
  it('runs FF-S03 as a carrier in clean and nestjs (no-layer-skip does not apply there), keeps layered no-layer-skip', async () => {
    expect((await compiled('clean-architecture', STATUS_QUO_ANSWERS)).disabled).toContain('FF-S03');
    const clean = await compiled('clean-architecture', withAnswers({ Q24: 'B' }));
    expect(clean.ids).toContain('FF-S03');
    expect(clean.cypher.get('FF-S03')).toContain('WHERE false');
    const nest = await compiled('nestjs', withAnswers({ Q24: 'B' }));
    expect(nest.params.get('FF-S03')?.excludePatterns).toBeDefined(); // the preset's **/*.module.ts exclude is kept
    const layered = await compiled('layered', withAnswers({ Q24: 'B' }));
    expect(layered.cypher.get('FF-S03')).toContain('allowedTransitions');
  });

  it('a carrier keeps its function name out of the compile when no switch is set', async () => {
    const spec = await presetSpec('clean-architecture');
    expect(spec.fitnessFunctions.some((f) => f.name === CONSTRUCT_CARRIER_NAME)).toBe(false);
  });
});

describe('Q25 B composition roots', () => {
  it('adds the composition-root globs to the layer rules only', async () => {
    const input = applyConstructCompileOverlays(compilerInputFromSpec(await presetSpec('nestjs')), withAnswers({ Q25: 'B' }));
    const fs01 = input.fitnessFunctions.find((f) => String(f.id) === 'FF-S01');
    const fp02 = input.fitnessFunctions.find((f) => String(f.id) === 'FF-P02');
    expect(fs01?.excludePaths).toEqual(expect.arrayContaining([...CONSTRUCT_COMPOSITION_ROOT_GLOBS]));
    expect(fp02?.excludePaths).toEqual([]);
    const c = await compiled('nestjs', withAnswers({ Q25: 'B' }));
    expect(c.params.get('FF-S01')?.excludePatterns).toBeDefined();
    expect((await compiled('nestjs', STATUS_QUO_ANSWERS)).params.get('FF-S01')?.excludePatterns).toBeUndefined();
  });
});

describe('options with no compile effect', () => {
  it.each([['Q2', 'B'], ['Q3', 'B'], ['Q3', 'C'], ['Q4', 'B'], ['Q5', 'B'], ['Q5', 'C'], ['Q6', 'B'], ['Q7', 'B'], ['Q8', 'B'], ['Q9', 'B'], ['Q9', 'C'],
    ['Q11', 'B'], ['Q12', 'B'], ['Q13', 'B'], ['Q14', 'B'], ['Q15', 'B'], ['Q18', 'B'], ['Q19', 'B'], ['Q20', 'B'], ['Q21', 'B'], ['Q22', 'B'], ['Q23', 'B']] as const)(
    '%s %s compiles every preset as the status quo does', async (q, o) => {
      for (const style of STYLES) {
        const a = await compiled(style, STATUS_QUO_ANSWERS);
        const b = await compiled(style, withAnswers({ [q]: o }));
        expect([...b.cypher.entries()]).toEqual([...a.cypher.entries()]);
        expect(b.disabled).toEqual(a.disabled);
      }
    });
});
