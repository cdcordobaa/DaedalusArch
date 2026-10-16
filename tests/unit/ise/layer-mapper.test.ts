import * as path from 'node:path';
import { expandGlob, inferLayerMapping, tokenLayer } from '../../../src/ise/layer-mapper.js';
import { loadIsePreset } from '../../../src/ise/preset.js';
import { cleanShaped, dddShaped, graph, hexShaped, layeredShaped } from './helpers.js';

const PRESETS = path.resolve('presets');

describe('ISE layer mapper', () => {
  it('expands an inner wildcard glob to the directories it matches and drops a glob that matches nothing', () => {
    const files = ['src/ordering/domain/a.ts', 'src/billing/domain/b.ts', 'src/main.ts'];
    expect(expandGlob('src/*/domain/**', files)).toEqual(['src/billing/domain/**', 'src/ordering/domain/**']);
    expect(expandGlob('src/main.ts', files)).toEqual(['src/main.ts']);
    expect(expandGlob('src/core/**', files)).toEqual([]);
  });

  it('maps tokens to preset layers by name first, then synonyms', () => {
    const clean = loadIsePreset('clean-architecture', PRESETS);
    expect(tokenLayer('domain', clean)).toBe('domain');
    expect(tokenLayer('usecases', clean)).toBe('application');
    expect(tokenLayer('kernel', clean)).toBeNull();
  });

  it('keeps the preset globs that match in preset-first mode', () => {
    const m = inferLayerMapping(cleanShaped(), 'clean-architecture', loadIsePreset('clean-architecture', PRESETS));
    expect(m.layers.map((l) => [l.name, l.directories])).toEqual([
      ['domain', ['src/domain/**']], ['application', ['src/application/**']], ['infrastructure', ['src/infrastructure/**']],
    ]);
    expect(m.files.every((f) => f.layer !== null && f.confidence >= 0.85)).toBe(true);
  });

  it('maps renamed directories from edge structure alone, with structure-only confidence', () => {
    const m = inferLayerMapping(cleanShaped('kernel', 'orchestration', 'platform'), 'clean-architecture', loadIsePreset('clean-architecture', PRESETS), 'infer-only');
    expect(m.layers.map((l) => [l.name, l.directories])).toEqual([
      ['domain', ['src/kernel/**']], ['application', ['src/orchestration/**']], ['infrastructure', ['src/platform/**']],
    ]);
    expect(m.units.every((u) => u.source === 'structure' && u.confidence === 0.5)).toBe(true);
  });

  it('leaves an entry file out of every layer when the preset has no composition layer', () => {
    const m = inferLayerMapping(layeredShaped('frontend', 'kernel', 'platform'), 'layered', loadIsePreset('layered', PRESETS), 'infer-only');
    expect(m.files.find((f) => f.file === 'src/main.ts')?.layer).toBeNull();
    expect(m.layers.map((l) => [l.name, l.directories])).toEqual([
      ['persistence', ['src/platform/**']], ['business', ['src/kernel/**']], ['presentation', ['src/frontend/**']],
    ]);
  });

  it('splits sibling hexagonal adapters by whether they implement inner ports', () => {
    const g = graph({
      files: ['src/k/Room.ts', 'src/o/RoomRepository.ts', 'src/o/BookRoom.ts', 'src/adapters/entry/RoomController.ts', 'src/adapters/exit/SqlRoomRepository.ts', 'src/setup/container.ts'],
      edges: [
        'src/o/BookRoom.ts>src/k/Room.ts', 'src/o/RoomRepository.ts>src/k/Room.ts', 'src/o/BookRoom.ts>src/o/RoomRepository.ts',
        'src/adapters/entry/RoomController.ts>src/o/BookRoom.ts', 'src/adapters/exit/SqlRoomRepository.ts>src/o/RoomRepository.ts',
        'src/setup/container.ts>src/adapters/entry/RoomController.ts', 'src/setup/container.ts>src/adapters/exit/SqlRoomRepository.ts', 'src/setup/container.ts>src/o/BookRoom.ts',
      ],
      classes: ['src/adapters/exit/SqlRoomRepository.ts', 'src/adapters/entry/RoomController.ts'],
      interfaces: ['src/o/RoomRepository.ts'],
      typeEdges: [['implements', 'src/adapters/exit/SqlRoomRepository.ts', 'src/o/RoomRepository.ts']],
    });
    const preset = loadIsePreset('hexagonal', PRESETS);
    const m = inferLayerMapping(g, 'hexagonal', preset, 'infer-only');
    const layerOf = (u: string): string | null | undefined => m.units.find((x) => x.unit === u)?.layer;
    expect(layerOf('src/k/')).toBe('domain');
    expect(layerOf('src/o/')).toBe('application');
    expect(layerOf('src/setup/')).toBe('config');
    expect(layerOf('src/adapters/entry/')).toBe('adapters-inbound');
    expect(layerOf('src/adapters/exit/')).toBe('adapters-outbound');
    expect(m.units.find((x) => x.unit === 'src/adapters/exit/')?.source).toBe('structure');
  });

  it('maps renamed hexagonal adapters by direction (implementers of inner ports are outbound)', () => {
    const m = inferLayerMapping(hexShaped('plugins', 'entry', 'exit'), 'hexagonal', loadIsePreset('hexagonal', PRESETS));
    const layerOf = new Map(m.units.map((u) => [u.unit, u.layer]));
    expect([layerOf.get('src/plugins/entry/'), layerOf.get('src/plugins/exit/'), layerOf.get('src/wiring/')]).toEqual(['adapters-inbound', 'adapters-outbound', 'config']);
  });

  it('maps the renamed layers of a bounded context by their level inside the context', () => {
    for (const between of ['', 'mod']) {
      const m = inferLayerMapping(dddShaped('kernel', 'orchestration', 'platform', between), 'ddd', loadIsePreset('ddd', PRESETS));
      const L = `src/ordering/${between === '' ? '' : `${between}/`}`;
      const layerOf = new Map(m.units.map((u) => [u.unit, u.layer]));
      expect([`${L}kernel/`, `${L}orchestration/`, `${L}platform/`, `${L}api/`].map((u) => layerOf.get(u))).toEqual(['domain', 'application', 'infrastructure', 'api']);
      expect(m.units.find((u) => u.unit === 'src/ordering/')?.source).toBe('public-api');
    }
  });
});
