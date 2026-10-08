import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';

function layer(name: string, kind: LayerKind): LayerDefinition {
  return { name, directories: [], naming: [], role: 'x', kind };
}

// business-logic-model.md §2.2 binding column (BR-U1-14); kinds given as resolved by C3.
describe('bindLayerParams (FR-19, BR-U1-14)', () => {
  it('specs/clean-arch.yaml and presets/clean-architecture.yaml', () => {
    expect(bindLayerParams([
      layer('domain', 'domain'), layer('application', 'application'), layer('infrastructure', 'infrastructure'),
    ])).toEqual({ domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'infrastructure', controllerLayer: 'infrastructure' });
  });

  it('presets/nestjs.yaml', () => {
    expect(bindLayerParams([
      layer('domain', 'domain'), layer('infrastructure', 'infrastructure'),
      layer('application', 'application'), layer('presentation', 'presentation'),
    ])).toEqual({
      domainLayer: 'domain', applicationLayers: ['application'],
      infraLayer: 'infrastructure', presentationLayer: 'presentation', controllerLayer: 'presentation',
    });
  });

  it('specs/daedalus-arch.yaml (core-modules kind: infrastructure)', () => {
    expect(bindLayerParams([
      layer('domain', 'domain'), layer('core-modules', 'infrastructure'), layer('application', 'application'),
    ])).toEqual({ domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'core-modules', controllerLayer: 'core-modules' });
  });

  it('presets/layered.yaml layers (inline)', () => {
    expect(bindLayerParams([
      layer('persistence', 'infrastructure'), layer('business', 'domain'), layer('presentation', 'presentation'),
    ])).toEqual({
      domainLayer: 'business', applicationLayers: [], infraLayer: 'persistence', presentationLayer: 'presentation',
      controllerLayer: 'presentation',
    });
  });

  it('position-inferred core, services, adapters', () => {
    expect(bindLayerParams([
      layer('core', 'domain'), layer('services', 'application'), layer('adapters', 'infrastructure'),
    ])).toEqual({ domainLayer: 'core', applicationLayers: ['services'], infraLayer: 'adapters', controllerLayer: 'adapters' });
  });

  it('2 layers: no application layer', () => {
    const b = bindLayerParams([layer('inner', 'domain'), layer('outer', 'infrastructure')]);
    expect(b).toEqual({ domainLayer: 'inner', applicationLayers: [], infraLayer: 'outer', controllerLayer: 'outer' });
    expect('presentationLayer' in b).toBe(false);
  });

  it('4 layers: applicationLayers in YAML order', () => {
    expect(bindLayerParams([
      layer('core', 'domain'), layer('a', 'application'), layer('b', 'application'), layer('edge', 'infrastructure'),
    ]).applicationLayers).toEqual(['a', 'b']);
  });

  it('duplicate scalar kind binds the first in YAML order (BR-U1-13)', () => {
    expect(bindLayerParams([
      layer('core', 'domain'), layer('domain', 'domain'), layer('edge', 'infrastructure'),
    ]).domainLayer).toBe('core');
  });

  it('controllerLayer (K16) is the last key and prefers presentation over infrastructure (ADR-016 a, BR-U1-46)', () => {
    const b = bindLayerParams([layer('d', 'domain'), layer('p', 'presentation'), layer('i', 'infrastructure')]);
    expect(Object.keys(b)).toEqual(['domainLayer', 'applicationLayers', 'infraLayer', 'presentationLayer', 'controllerLayer']);
    expect(b.controllerLayer).toBe('p');
  });
});
