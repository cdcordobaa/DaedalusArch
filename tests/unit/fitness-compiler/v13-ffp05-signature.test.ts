/**
 * v1.3 fix batch: FF-P05 controller-no-entity through the SIGNATURE_USES type edge (`v13-signature-types.ts`,
 * `Docs/v1.3/ffp05-type-edges.md`). The compile tests check the query text; the query's rows are checked with its
 * in-memory mirror on APG v2 extractions of the reference variants (as the APG v2 template tests do). The live Cypher
 * run needs Neo4j and is not part of this suite.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileFunctions, instantiateTemplate, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CompileOptions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { applySignatureTypes, FF_P05_SIGNATURE_BRANCH, FF_P05_TEMPLATE, ffp05SignatureEntity } from '../../../src/fitness-compiler/v13-signature-types.js';
import { memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import { extractAPG, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/index.js';
import type { ExtractorOptions } from '../../../src/apg-extractor/index.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';
import { loadReference } from '../../../scripts/v1.3/lib/reference-model.js';
import type { ReferenceStyle } from '../../../scripts/v1.3/lib/reference-model.js';
import { makeTempRoot, materialiseVariant } from '../../../scripts/v1.3/lib/materialise.js';

const ROOT = path.resolve(__dirname, '../../..');

async function parsed(specPath: string): Promise<{ layerModel: LayerModel; compile: (o: CompileOptions) => CompiledFunctions }> {
  const p = await parseSpec({ specFilePath: specPath });
  if (!p.success) throw new Error(p.errors.map((e) => e.message).join('; '));
  return {
    layerModel: p.data.layerModel,
    compile: (o) => {
      const r = compileFunctions(compilerInputFromSpec(p.data), o);
      if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
      return r.data;
    },
  };
}

function ffp05(c: CompiledFunctions): string {
  const q = c.symbolicQueries.find((x) => x.name === FF_P05_TEMPLATE);
  if (q === undefined) throw new Error('FF-P05 not compiled');
  return q.cypher;
}

function frozenTemplate(): CypherTemplate {
  const t = CYPHER_TEMPLATES.get(FF_P05_TEMPLATE);
  if (t === undefined) throw new Error('no frozen FF-P05 template');
  return t;
}

describe('FF-P05 signature branch: compiled text', () => {
  const SPECS = ['presets/nestjs.yaml', 'presets/clean-architecture.yaml'];

  it.each(SPECS)('%s: without signatureTypes FF-P05 compiles as in v1.2E', async (spec) => {
    const s = await parsed(path.join(ROOT, spec));
    const { signatureTypes: _off, ...rest } = V13_COMPILE_OPTIONS;
    expect(ffp05(s.compile(rest))).not.toContain('SIGNATURE_USES');
    expect(ffp05(s.compile({}))).toBe(instantiateTemplate(frozenTemplate(), {}));
  });

  it.each(SPECS)('%s: signatureTypes alone changes FF-P05 only', async (spec) => {
    const s = await parsed(path.join(ROOT, spec));
    const off = s.compile({});
    const on = s.compile({ signatureTypes: true });
    expect(on.symbolicQueries.map((q) => q.name)).toEqual(off.symbolicQueries.map((q) => q.name));
    for (const [i, q] of on.symbolicQueries.entries()) {
      if (q.name === FF_P05_TEMPLATE) expect(q.cypher).not.toBe(off.symbolicQueries[i]?.cypher);
      else expect(q).toEqual(off.symbolicQueries[i]);
    }
  });

  it.each(SPECS)('%s: under V13_COMPILE_OPTIONS the frozen branch keeps its rewrites and the signature branch is added', async (spec) => {
    const s = await parsed(path.join(ROOT, spec));
    const q = ffp05(s.compile(V13_COMPILE_OPTIONS));
    expect(q.startsWith('CALL {\nMATCH (ctrl:Class)-[_ev0:IMPORTS|CONSTRUCTOR_INJECTS*1..2]->(entity:Class)')).toBe(true);
    expect(q).toContain("ANY(role IN $entityRoles WHERE entity.name ENDS WITH role OR entity.name ENDS WITH role + 'Impl')");
    expect(q.match(/ALL\(_evr IN _ev0 WHERE NOT coalesce\(_evr\.reExportHop, false\)\)/g)).toHaveLength(1);
    expect(q).toContain(`\nUNION\n${FF_P05_SIGNATURE_BRANCH.replace('/*EXCLUDE:ctrl*/', '')}\n}`);
    expect(q.endsWith('\n}\nRETURN controller, entity, filePath\nORDER BY filePath, controller, entity')).toBe(true);
    expect(q).not.toContain('/*EXCLUDE');
  });

  it('the branch uses only the frozen template\'s parameters and returns its columns', () => {
    const t = frozenTemplate();
    for (const p of FF_P05_SIGNATURE_BRANCH.matchAll(/\$([A-Za-z]+)/g)) expect(t.requiredParams).toContain(p[1]);
    expect(FF_P05_SIGNATURE_BRANCH).toMatch(/RETURN ctrl\.name AS controller, entity\.name AS entity, ctrl\.filePath AS filePath$/);
  });

  it('exclude paths apply to the controller in both branches', () => {
    const text = instantiateTemplate(applySignatureTypes(frozenTemplate()), { excludePatterns: ['^src/legacy/.*$'] });
    expect(text.match(/AND NONE\(ep IN \$excludePatterns WHERE ctrl\.filePath =~ ep\)/g)).toHaveLength(2);
  });

  it('leaves every other template and the frozen text unchanged', () => {
    for (const [name, t] of CYPHER_TEMPLATES) {
      if (name !== FF_P05_TEMPLATE) expect(applySignatureTypes(t)).toBe(t);
    }
    expect(frozenTemplate().template).not.toContain('SIGNATURE_USES');
  });
});

describe('FF-P05 signature branch: rows on the reference variants (in-memory mirror)', () => {
  let work: string;
  beforeAll(() => {
    work = makeTempRoot('v13-ffp05-');
  });
  afterAll(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  async function rows(style: ReferenceStyle, variant: string, options: ExtractorOptions): Promise<unknown[]> {
    const ref = loadReference(ROOT, style);
    const v = ref.variants.find((x) => x.manifest.variant === variant);
    if (v === undefined) throw new Error(`no variant ${style}/${variant}`);
    const m = materialiseVariant(ref, v, work);
    const { layerModel } = await parsed(ref.specPath);
    const apg = await extractAPG(m.projectDir, options);
    if (!apg.success) throw new Error(`extraction failed: ${style}/${variant}`);
    const b = bindLayerParams(layerModel.layers);
    return ffp05SignatureEntity(memGraph(apg.data, layerModel), {
      ...(b.controllerLayer !== undefined ? { controllerLayer: b.controllerLayer } : {}),
      ...(b.domainLayer !== undefined ? { domainLayer: b.domainLayer } : {}),
    });
  }

  it('nestjs v09: WorkshopsController.findOne returns the Workshop entity', async () => {
    expect(await rows('nestjs', 'v09-controller-returns-entity', V13_APG2_OPTIONS))
      .toEqual([{ controller: 'WorkshopsController', entity: 'Workshop', filePath: 'src/workshops/workshops.controller.ts' }]);
  }, 60_000);

  it('nestjs v09 without APG v2 edges: no row (the branch reads only SIGNATURE_USES)', async () => {
    expect(await rows('nestjs', 'v09-controller-returns-entity', V13_DEFAULT_OPTIONS)).toEqual([]);
  }, 60_000);

  it.each<[ReferenceStyle, string]>([
    ['nestjs', 'clean'],
    ['nestjs', 'n01-controller-catches-domain-error'],
    ['nestjs', 'n02-domain-port-named-dot-repository'],
    ['nestjs', 'n03-service-injects-sibling-service'],
    ['clean-architecture', 'clean'],
    ['clean-architecture', 'n03-controller-uses-dto-that-wraps-entity'],
  ])('%s %s: no row (clean project and near-misses)', async (style, variant) => {
    expect(await rows(style, variant, V13_APG2_OPTIONS)).toEqual([]);
  }, 60_000);

  it('clean-architecture v07: no row (the entity is used only in the method body; a documented miss)', async () => {
    expect(await rows('clean-architecture', 'v07-controller-reads-entity', V13_APG2_OPTIONS)).toEqual([]);
  }, 60_000);
});
