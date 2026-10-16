/**
 * MT-B1 (v1.3 metamorphic run, Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md): `resolvedEdgesInLiteralView`,
 * OFF by default. Fixture: `fixtures/unit/v13-barrels` (the order-fulfilment shape: infrastructure -> application
 * barrel -> domain).
 */
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import { literalEdgeView } from '../../../src/shared/apg-edge-view.js';
import type { APGResult } from '../../../src/shared/types/apg.js';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/unit/v13-barrels');
const FILE = 'src/infrastructure/persistence/InMemoryOrderRepository.ts';
const BARREL = 'src/application/ports/persistence.ts';

async function extract(options: object): Promise<APGResult> {
  const r = await extractAPG(FIXTURE, options);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

interface Edge { from: string; to: string; names: string[]; typeOnly: boolean; via: boolean; barrels: unknown; hop: boolean }

function importEdges(apg: APGResult, edges = apg.edges): Edge[] {
  const name = new Map(apg.nodes.map((n) => [n.id, n.type === 'File' ? n.filePath : `pkg:${String(n.name)}`]));
  return edges.filter((e) => e.type === 'IMPORTS').map((e) => {
    const p = e.properties as Record<string, unknown>;
    return {
      from: name.get(e.sourceId) ?? e.sourceId,
      to: name.get(e.targetId) ?? e.targetId,
      names: p.importedNames as string[],
      typeOnly: p.isTypeOnly === true,
      via: p.viaReExport === true,
      barrels: p.reExportBarrels,
      hop: p.reExportHop === true,
    };
  });
}

let base: APGResult;
let on: APGResult;

beforeAll(async () => {
  base = await extract({});
  on = await extract({ resolvedEdgesInLiteralView: true });
}, 60_000);

describe('resolvedEdgesInLiteralView (MT-B1)', () => {
  it('is OFF in the v1.2E and v1.3 defaults, and OFF extracts the default graph byte for byte', async () => {
    expect(V12E_DEFAULT_OPTIONS.resolvedEdgesInLiteralView).toBe(false);
    expect(V13_DEFAULT_OPTIONS.resolvedEdgesInLiteralView).toBe(false);
    expect(JSON.stringify(await extract({ resolvedEdgesInLiteralView: false }))).toBe(JSON.stringify(base));
  });

  it('ON: the edges through a barrel lose the viaReExport mark; the barrel hop edge is unchanged', () => {
    const mine = importEdges(on).filter((e) => e.from === FILE);
    expect(mine.filter((e) => e.hop)).toEqual([{ from: FILE, to: BARREL, names: ['Order', 'OrderRepository', 'OrderSnapshot', 'OrderStatus'], typeOnly: false, via: false, barrels: undefined, hop: true }]);
    const resolved = mine.filter((e) => !e.hop).map((e) => ({ to: e.to, names: e.names, typeOnly: e.typeOnly, via: e.via, barrels: e.barrels }));
    expect(resolved).toEqual([
      { to: 'src/domain/entities/Order.ts', names: ['Order', 'OrderSnapshot'], typeOnly: false, via: false, barrels: undefined },
      { to: 'src/domain/repositories/OrderRepository.ts', names: ['OrderRepository'], typeOnly: true, via: false, barrels: undefined },
      { to: 'src/domain/value-objects/OrderStatus.ts', names: ['OrderStatus'], typeOnly: true, via: false, barrels: undefined },
    ]);
  });

  it('ON: the literal view keeps the edges to the declaring files; OFF it ends at the barrel', () => {
    const offLiteral = importEdges(base, literalEdgeView(base.edges)).filter((e) => e.from === FILE).map((e) => e.to);
    const onLiteral = importEdges(on, literalEdgeView(on.edges)).filter((e) => e.from === FILE).map((e) => e.to);
    expect(offLiteral).toEqual([BARREL]);
    expect(onLiteral).toEqual([BARREL, 'src/domain/entities/Order.ts', 'src/domain/repositories/OrderRepository.ts', 'src/domain/value-objects/OrderStatus.ts']);
  });

  it('ON: nothing else changes (same edges and nodes once the two marks are dropped)', () => {
    const strip = (apg: APGResult): string[] =>
      importEdges(apg).map((e) => JSON.stringify({ ...e, via: undefined, barrels: undefined })).sort();
    expect(strip(on)).toEqual(strip(base));
    expect(on.nodes).toEqual(base.nodes);
    expect(on.edges.filter((e) => e.type !== 'IMPORTS')).toEqual(base.edges.filter((e) => e.type !== 'IMPORTS'));
    expect(importEdges(on).some((e) => e.via)).toBe(false);
  });

  it('has no effect with reExportEdges resolved-only (the v1.2E graph)', async () => {
    const v12e = await extract(V12E_DEFAULT_OPTIONS);
    const v12eOn = await extract({ ...V12E_DEFAULT_OPTIONS, resolvedEdgesInLiteralView: true });
    expect(JSON.stringify(v12eOn)).toBe(JSON.stringify(v12e));
  });
});
