/**
 * U5 evasion check, A3 and the spec-derived guarded pairs (design §2.4, §2.5): the Layered closed-layering pairs, the
 * Hexagonal `allowedDependencies` pairs, the DDD outside-context exemption, and an observed pair that is listed but
 * never counted (EV-06a). Synthetic fixtures; no model, no Neo4j.
 */
import {
  blockingFunctions,
  buildGraph,
  guardIndex,
  observedPairsNotInSpec,
  parseTierTable,
  placementModel,
  specGuardedPairs,
} from '../../../../../scripts/v1.3/lib/evasion/import-graph.js';
import { newOutOfScopeEdges, outOfScope } from '../../../../../scripts/v1.3/lib/evasion/out-of-scope.js';
import { FIX_REL, loadCase, loadSpec, tierText } from './helpers.js';

const tiers = (): ReturnType<typeof parseTierTable> => parseTierTable(tierText().text);

async function pairsOf(rel: string): Promise<string[]> {
  const spec = await loadSpec(rel);
  return specGuardedPairs(placementModel(spec), blockingFunctions(spec, tiers())).map((p) => `${p.source}>${p.target}:${p.functions.join('+')}`);
}

describe('guarded pairs come from the spec and the blocking tier only', () => {
  it('Layered (presets/layered.yaml): closed layering, upward imports and skips', async () => {
    expect(await pairsOf(`${FIX_REL}/spec.yaml`)).toEqual([
      'business>presentation:FF-S01',
      'persistence>business:FF-S01',
      'persistence>presentation:FF-S01',
      'presentation>persistence:FF-S03',
    ]);
  });

  it('Clean (specs/clean-arch.yaml): inward only; FF-S03 is advisory outside layered', async () => {
    expect(await pairsOf('specs/clean-arch.yaml')).toEqual(['application>infrastructure:FF-S01', 'domain>application:FF-S01', 'domain>infrastructure:FF-S01']);
  });

  it('Hexagonal (presets/hexagonal.yaml): every layer pair not in allowedDependencies', async () => {
    const pairs = await pairsOf(`${FIX_REL}/spec-hexagonal.yaml`);
    expect(pairs).toContain('domain>adapters-outbound:FF-S01');
    expect(pairs).toContain('application>adapters-inbound:FF-S01');
    expect(pairs).not.toContain('adapters-outbound>domain:FF-S01');
    expect(pairs).not.toContain('config>adapters-outbound:FF-S01');
    expect(pairs).toHaveLength(11); // 20 ordered pairs of five layers, 9 allowed
  });

  it('an observed pair outside the spec is listed, and changes no count (EV-06a)', async () => {
    const spec = await loadSpec(`${FIX_REL}/spec.yaml`);
    const model = placementModel(spec);
    const g = guardIndex(specGuardedPairs(model, blockingFunctions(spec, tiers())));
    const before = JSON.stringify(g.pairs);
    expect(observedPairsNotInSpec(g, [['business', 'persistence'], ['presentation', 'persistence']])).toEqual([['business', 'persistence']]);
    expect(JSON.stringify(g.pairs)).toBe(before);
  });
});

describe('A3 out of scope', () => {
  it('counts unmapped files and edges; an outside_contexts file is exempt (declaredOutsideEdges)', async () => {
    const c = loadCase('outside-context');
    const spec = await loadSpec(`${FIX_REL}/${c.expected.spec}`);
    const model = placementModel(spec);
    const g = guardIndex(specGuardedPairs(model, blockingFunctions(spec, tiers())));
    const r = outOfScope(c.t0, buildGraph(c.t0), model, g);
    expect(r.unmappedFiles).toBe(c.expected.outOfScope?.unmappedFiles);
    expect(r.outOfScopeEdges).toEqual(c.expected.outOfScope?.outOfScopeEdges);
    expect(r.declaredOutsideEdges).toBe(c.expected.outOfScope?.declaredOutsideEdges);
    expect(r.unmappedShare).toBeCloseTo(1 / 3, 6);
  });

  it('an unmapped helper reaching persistence is an out-of-scope edge on the layered spec', async () => {
    const c = loadCase('relocated-unmapped');
    const spec = await loadSpec(`${FIX_REL}/spec.yaml`);
    const model = placementModel(spec);
    const g = guardIndex(specGuardedPairs(model, blockingFunctions(spec, tiers())));
    expect(outOfScope(c.t1, buildGraph(c.t1), model, g).outOfScopeEdges).toEqual([
      'src/helpers/order-reader.ts -> src/persistence/order-store.ts (static)',
      'src/presentation/orders-page.ts -> src/helpers/order-reader.ts (static)',
    ]);
  });

  it('new edges by file pair against every earlier snapshot, renames followed', () => {
    const none = { map: new Map<string, string>(), renameDetection: 'full' as const };
    const rho = { map: new Map([['src/x.ts', 'src/y.ts']]), renameDetection: 'full' as const };
    expect(
      newOutOfScopeEdges([
        { edges: ['src/x.ts -> src/p.ts (static)'], rho: none },
        { edges: ['src/y.ts -> src/p.ts (static)', 'src/z.ts -> src/p.ts (dynamic)'], rho },
        { edges: ['src/z.ts -> src/p.ts (static)'], rho: none },
      ]),
    ).toEqual([1, 1, 0]);
  });
});
