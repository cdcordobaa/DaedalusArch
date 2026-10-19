/**
 * v1.4 U2 FF-P07 application-purity (design BR-U2-05, §6 test 2; plan step 9.2): seeded positives and twins on
 * hand-built graphs, written through the real ingestion into the in-process interpreter, with the style's reference
 * spec compiled as the v1.3 pipeline compiles it. The Cypher text is the catalogue's. No Neo4j, no network, no model.
 */
import { evaluate, Graph } from '../semantic-rules/semantic-harness.js';
import type { Style } from '../semantic-rules/semantic-harness.js';
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { specAt } from './helpers.js';

interface StyleCase {
  readonly style: Style;
  /** An application-kind layer that is not a composition root. */
  readonly app: string;
  /** The domain layer and the id of its purity rule (FF-P01, or FF-DT04 in ddd). */
  readonly domain: string;
  readonly domainRule: string;
  /** A presentation layer or inbound adapter. */
  readonly outer: string;
  /** Composition-root files: [path, layer]. */
  readonly roots: readonly (readonly [string, string])[];
}

const CASES: readonly StyleCase[] = [
  { style: 'clean-architecture', app: 'application', domain: 'domain', domainRule: 'FF-P01', outer: 'infrastructure',
    roots: [['src/main.ts', 'application'], ['src/application/app.module.ts', 'application']] },
  { style: 'hexagonal', app: 'application', domain: 'domain', domainRule: 'FF-P01', outer: 'adapters-inbound',
    roots: [['src/config/container.ts', 'config'], ['src/config/wiring/http.ts', 'config'], ['src/main.ts', 'application']] },
  { style: 'nestjs', app: 'application', domain: 'domain', domainRule: 'FF-P01', outer: 'presentation',
    roots: [['src/main.ts', 'application'], ['src/order/order.module.ts', 'application']] },
  { style: 'ddd', app: 'application', domain: 'domain', domainRule: 'FF-DT04', outer: 'api',
    roots: [['src/main.ts', 'composition'], ['src/ordering/ordering.module.ts', 'application']] },
];

const SERVICE = 'src/ordering/application/PlaceOrderService.ts';

describe.each(CASES)('FF-P07 application-purity: $style', (c) => {
  it('tier and source per the post-seal record', () => {
    expect(ruleTier('FF-P07', c.style)).toMatchObject({ tier: 'blocking', source: 'post-seal' });
  });

  it('positive: an application service that imports express as a value', async () => {
    const g = new Graph();
    g.imports(g.file(SERVICE, c.app), g.pkg('express'));
    const r = await evaluate(c.style, 'FF-P07', g);
    expect(r.keys).toEqual([`${SERVICE} -> express (IMPORTS)`]);
    expect(r.violations[0]?.message).toContain('delivery-framework package express');
  });

  it('positive: the same import as `import type` (type-only imports count, D3)', async () => {
    const g = new Graph();
    g.imports(g.file(SERVICE, c.app), g.pkg('express'), { isTypeOnly: true });
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([`${SERVICE} -> express (IMPORTS)`]);
  });

  it('positive: a re-export of fastify', async () => {
    const g = new Graph();
    g.reExports(g.file('src/ordering/application/index.ts', c.app), g.pkg('fastify'));
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual(['src/ordering/application/index.ts -> fastify (RE_EXPORTS)']);
  });

  it('positive: a scoped package by prefix (@hapi/*)', async () => {
    const g = new Graph();
    g.imports(g.file(SERVICE, c.app), g.pkg('@hapi/hapi'));
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([`${SERVICE} -> @hapi/hapi (IMPORTS)`]);
  });

  it('twin: the DTO (no package import) gives no row', async () => {
    const g = new Graph();
    g.imports(g.file(SERVICE, c.app), g.file('src/ordering/application/PlaceOrderContextDto.ts', c.app));
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([]);
  });

  it('twin: express in a composition root gives no row', async () => {
    const g = new Graph();
    const express = g.pkg('express');
    for (const [file, layer] of c.roots) g.imports(g.file(file, layer), express);
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([]);
  });

  it('twin: express in an application test file gives no row', async () => {
    const g = new Graph();
    const express = g.pkg('express');
    g.imports(g.file('src/ordering/application/PlaceOrderService.spec.ts', c.app), express);
    g.imports(g.file('src/ordering/application/__tests__/helpers.ts', c.app), express);
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([]);
  });

  it('twin: @nestjs/common (Injectable) in an application service gives no row', async () => {
    const g = new Graph();
    g.imports(g.file(SERVICE, c.app), g.pkg('@nestjs/common'));
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([]);
  });

  it(`twin: express in ${String(c.outer)} gives no row`, async () => {
    const g = new Graph();
    g.imports(g.file('src/ordering/http/OrderController.ts', c.outer), g.pkg('express'));
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([]);
  });

  it(`twin: express in the domain is ${String(c.domainRule)}'s, not FF-P07's (no double count)`, async () => {
    const g = new Graph();
    g.imports(g.file('src/ordering/domain/Order.ts', c.domain), g.pkg('express'));
    expect((await evaluate(c.style, 'FF-P07', g)).keys).toEqual([]);
    expect((await evaluate(c.style, c.domainRule, g)).keys).toEqual(['src/ordering/domain/Order.ts -> express (IMPORTS)']);
  });
});

describe('FF-P07 application-purity: layered', () => {
  it('is not compiled (no application-kind layer; FF-P01 covers the business layer)', async () => {
    const spec = await specAt('tests/fixtures/v1.3-reference/layered/spec.yaml');
    const r = compileFunctions(compilerInputFromSpec(spec), V13_COMPILE_OPTIONS);
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    expect(r.data.symbolicQueries.map((q) => String(q.functionId))).not.toContain('FF-P07');
    expect(r.data.disabledFunctions.map((d) => String(d.id))).not.toContain('FF-P07');
  });
});
