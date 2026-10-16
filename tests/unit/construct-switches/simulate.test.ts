/** The offline stand-ins the re-score uses for compile-time options (Q1 B/C, Q13 C, Q16 B). */
import { simulateTemplate } from '../../../scripts/v1.3/lib/construct-simulate.js';
import { layerViewOf } from '../../../src/construct-switches/layer-view.js';
import type { FitnessFunction } from '../../../src/shared/types/spec.js';
import type { FunctionId } from '../../../src/shared/types/value-objects.js';
import { graph, presetSpec } from './fixtures.js';

const ff = (id: string, name: string): FitnessFunction => ({ id: id as FunctionId, name, dimension: 'structural', severity: 'critical', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [] });

describe('offline stand-ins', () => {
  it('no-cyclic-deps: one row per simple cycle, started at its smallest file, as the Cypher writes it', async () => {
    const g = graph({ files: { 'src/a.ts': null, 'src/b.ts': null, 'src/c.ts': null },
      edges: [{ from: 'src/b.ts', to: 'src/a.ts' }, { from: 'src/a.ts', to: 'src/b.ts' }, { from: 'src/b.ts', to: 'src/c.ts' }, { from: 'src/c.ts', to: 'src/a.ts' }, { from: 'src/c.ts', to: 'src/b.ts', viaReExport: true }] });
    const rows = simulateTemplate(ff('FF-S02', 'no-cyclic-deps'), g, layerViewOf((await presetSpec('ddd')).layerModel));
    expect(rows.map((r) => [r.filePath, r.target])).toEqual([
      ['src/a.ts,src/b.ts,src/a.ts', 'src/b.ts'],
      ['src/a.ts,src/b.ts,src/c.ts,src/a.ts', 'src/b.ts'],
    ]);
  });

  it('dependency-direction: lower layer importing a higher one, in the given order', async () => {
    const spec = await presetSpec('nestjs');
    const g = graph({ files: { 'src/r/r.service.ts': 'application', 'src/r/r.repository.ts': 'infrastructure' }, edges: [{ from: 'src/r/r.service.ts', to: 'src/r/r.repository.ts' }, { from: 'src/r/r.repository.ts', to: 'src/r/r.service.ts' }] });
    expect(simulateTemplate(ff('FF-S01', 'dependency-direction'), g, layerViewOf(spec.layerModel)).map((r) => r.filePath)).toEqual(['src/r/r.repository.ts']);
    const clean = { ...spec.layerModel, layers: [...spec.layerModel.layers].sort((a, b) => ['domain', 'application', 'presentation', 'infrastructure'].indexOf(a.name) - ['domain', 'application', 'presentation', 'infrastructure'].indexOf(b.name)) };
    expect(simulateTemplate(ff('FF-S01', 'dependency-direction'), g, layerViewOf(clean)).map((r) => r.filePath)).toEqual(['src/r/r.service.ts']);
  });

  it('domain-state-purity: a domain class holding an infrastructure class', async () => {
    const spec = await presetSpec('layered');
    const g = graph({ files: { 'src/business/services/OrderService.ts': 'business', 'src/persistence/OrderGateway.ts': 'persistence' },
      classes: [{ id: 'OrderService', file: 'src/business/services/OrderService.ts' }, { id: 'OrderGateway', file: 'src/persistence/OrderGateway.ts' }],
      classEdges: [{ from: 'OrderService', to: 'OrderGateway', type: 'CONSTRUCTOR_INJECTS', field: 'orders' }] });
    const rows = simulateTemplate(ff('FF-P06', 'domain-state-purity'), g, layerViewOf(spec.layerModel));
    expect(rows.map((r) => [r.filePath, r.target, r.discriminator])).toEqual([['src/business/services/OrderService.ts', 'src/persistence/OrderGateway.ts', ['OrderService', 'OrderGateway', 'CONSTRUCTOR_INJECTS', 'orders']]]);
  });

  it('refuses a template it has no stand-in for', async () => {
    const view = layerViewOf((await presetSpec('ddd')).layerModel);
    expect(() => simulateTemplate(ff('FF-X', 'module-fan-out'), graph({ files: {} }), view)).toThrow('no offline stand-in');
  });
});
