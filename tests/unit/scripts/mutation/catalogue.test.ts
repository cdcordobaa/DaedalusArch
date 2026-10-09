/**
 * Registered catalogue and the frozen operator catalogue (U5a plan Step 31; FR-24 amendment; BR-U5a-05, 20, 21, 38,
 * 39; D-U5a-10).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { SYMBOLIC_DIMENSIONS } from '../../../../src/shared/types/enums.js';
import { parseCatalogue } from '../../../../scripts/lib/mutation/catalogue-parser.js';
import { loadCompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { RENAME_SUFFIXES, TWIN_PREFIXES } from '../../../../scripts/lib/mutation/operators/mo-cv02.js';
import {
  CATALOGUE_OPERATORS,
  CATALOGUE_PATH,
  MASTER_SEED,
  buildCatalogueRegistry,
  loadCatalogueRegistry,
} from '../../../../scripts/lib/mutation/operators/index.js';
import { catalogueVersionOf } from '../../../../scripts/lib/mutation/registry.js';
import { deriveSeed } from '../../../../scripts/lib/mutation/rng.js';
import type { MutationOperator } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const TEXT = fs.readFileSync(path.resolve(REPO, CATALOGUE_PATH), 'utf8');

function parsed(): ReturnType<typeof parseCatalogue> extends DomainResult<infer T> ? T : never {
  const r = parseCatalogue(TEXT);
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

describe('registry ↔ catalogue (BR-U5a-38, 39)', () => {
  it('22 entries, one to one on id, twin, core, dimension, expected templates, coverage, source', () => {
    const entries = parsed().entries;
    expect(entries).toHaveLength(22);
    expect(CATALOGUE_OPERATORS).toHaveLength(22);
    const registry = buildCatalogueRegistry('d'.repeat(64));
    expect(entries.map((e) => e.id).sort()).toEqual(registry.list().map((o) => o.id));
    for (const e of entries) {
      const op = registry.get(e.id);
      if (op === undefined) throw new Error(`${e.id} not registered`);
      const twin = op.role === 'twin' ? op.twinOf : CATALOGUE_OPERATORS.find((o) => o.twinOf === op.id)?.id;
      expect([e.id, e.twin, e.core, e.dimension, e.expectedTemplates, e.coverage, e.source, e.operatorCollateral]).toEqual([
        op.id,
        twin,
        op.core,
        op.dimension,
        op.expectedTemplates.map((r) => r.template),
        op.coverage,
        op.source,
        op.operatorCollateral.map((r) => r.template),
      ]);
    }
  });

  it('catalogueVersion is the sha256 of the committed file; a one-byte change alters it', () => {
    const r = loadCatalogueRegistry(REPO);
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    expect(r.data.catalogueVersion).toBe(catalogueVersionOf(fs.readFileSync(path.resolve(REPO, CATALOGUE_PATH))));
    expect(catalogueVersionOf(TEXT + ' ')).not.toBe(r.data.catalogueVersion);
  });

  it('the registry is frozen at load: register → CAT_FROZEN', () => {
    const r = loadCatalogueRegistry(REPO);
    if (!r.success) throw new Error('load');
    const op = CATALOGUE_OPERATORS[0];
    if (op === undefined) throw new Error('empty');
    const res = r.data.register({ ...op, id: 'MO-LATE' });
    expect(!res.success && res.errors[0]?.code).toBe('CAT_FROZEN');
  });

  it('FROZEN header, master seed and vectors, rename list, sitesPerOperator 2, E1 orderSeed, SP section, changelog, threats', () => {
    expect(TEXT.startsWith('# Operator Catalogue (FROZEN)')).toBe(true);
    expect(TEXT).toContain(`\`masterSeed = ${String(MASTER_SEED)}\``);
    expect(TEXT).toContain(`\`${String(deriveSeed(MASTER_SEED, { projectId: 'correct-reference', operatorId: 'MO-S01', k: 0 }))}\``);
    expect(TEXT).toContain(`\`${String(deriveSeed(MASTER_SEED, { projectId: 'correct-reference', operatorId: 'MO-S01', k: 'select' }))}\``);
    expect(TEXT).toContain(`suffixes ${RENAME_SUFFIXES.map((s) => `\`${s}\``).join(', ')}`);
    expect(TEXT).toContain(`prefixes ${TWIN_PREFIXES.map((s) => `\`${s}\``).join(', ')}`);
    expect(TEXT).toContain('`sitesPerOperator: 2`');
    expect(TEXT).toContain('E1 `orderSeed = 20261008`');
    expect(TEXT).toContain('## 7. Threats to validity (BR-U5a-40)');
    expect(TEXT).toContain('## 5. SP-* sensitivity probes');
    expect(TEXT).toContain('## 6. Changelog');
  });
});

describe('catalogue measurement policy (BR-U5a-05, 21)', () => {
  const golden = (o: MutationOperator): boolean =>
    o.role === 'positive' && o.judgeProbe === undefined && (SYMBOLIC_DIMENSIONS as readonly string[]).includes(o.dimension);

  it('golden operators target no ratio, cannot-fire or probe-only template', () => {
    const targeted = new Set(CATALOGUE_OPERATORS.filter(golden).flatMap((o) => o.expectedTemplates.map((r) => r.template)));
    for (const t of ['dependency-inversion', 'domain-stability', 'abstraction-ratio', 'component-instability', 'naming-conventions', 'naming-controllers']) {
      expect([t, targeted.has(t)]).toEqual([t, false]);
    }
  });

  it("every operator's expected templates share the operator's dimension (compiled clean-arch and layered specs)", async () => {
    const specs = await Promise.all([loadCompiledSpec(REPO, 'specs/clean-arch.yaml'), loadCompiledSpec(REPO, 'tests/fixtures/u5a/layered/firewall.spec.yaml')]);
    const dims = new Map<string, string>();
    for (const s of specs) {
      if (!s.success) throw new Error(JSON.stringify(s.errors));
      for (const [t, fns] of s.data.enabled) for (const f of fns) dims.set(t, f.dimension);
    }
    for (const o of CATALOGUE_OPERATORS) {
      const seen = new Set(o.expectedTemplates.flatMap((r) => (dims.has(r.template) ? [dims.get(r.template)] : [])));
      expect([o.id, [...seen].every((d) => d === o.dimension), seen.size <= 1]).toEqual([o.id, true, true]);
    }
    expect(CATALOGUE_OPERATORS.some((o) => (o.dimension as string) === 'data-flow')).toBe(false);
  });

  it('judge probes carry no expected template; twins carry no expected template', () => {
    for (const o of CATALOGUE_OPERATORS) {
      if (o.judgeProbe !== undefined || o.role === 'twin') expect([o.id, o.expectedTemplates]).toEqual([o.id, []]);
    }
  });
});
