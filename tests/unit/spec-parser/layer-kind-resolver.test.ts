import { resolveLayerKinds } from '../../../src/spec-parser/layer-kind-resolver.js';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';

function layer(name: string, kind?: LayerKind): LayerDefinition {
  return { name, directories: [], naming: [], role: 'x', ...(kind ? { kind } : {}) };
}

function kinds(layers: readonly LayerDefinition[]): [string, string | undefined, string | undefined][] {
  return resolveLayerKinds(layers).layers.map((l) => [l.name, l.kind, l.kindSource]);
}

describe('resolveLayerKinds (FR-19, BR-U1-12; business-logic-model.md §2.2)', () => {
  it('specs/clean-arch.yaml: all three by name', () => {
    expect(kinds([layer('domain'), layer('application'), layer('infrastructure')])).toEqual([
      ['domain', 'domain', 'name'],
      ['application', 'application', 'name'],
      ['infrastructure', 'infrastructure', 'name'],
    ]);
  });

  it('presets/nestjs.yaml: all four by name, presentation included', () => {
    expect(kinds([layer('domain'), layer('infrastructure'), layer('application'), layer('presentation')])).toEqual([
      ['domain', 'domain', 'name'],
      ['infrastructure', 'infrastructure', 'name'],
      ['application', 'application', 'name'],
      ['presentation', 'presentation', 'name'],
    ]);
  });

  it('specs/daedalus-arch.yaml after Q3 B: core-modules explicit infrastructure', () => {
    expect(kinds([layer('domain'), layer('core-modules', 'infrastructure'), layer('application')])).toEqual([
      ['domain', 'domain', 'name'],
      ['core-modules', 'infrastructure', 'explicit'],
      ['application', 'application', 'name'],
    ]);
  });

  it('presets/layered.yaml: all explicit', () => {
    expect(kinds([
      layer('persistence', 'infrastructure'), layer('business', 'domain'), layer('presentation', 'presentation'),
    ])).toEqual([
      ['persistence', 'infrastructure', 'explicit'],
      ['business', 'domain', 'explicit'],
      ['presentation', 'presentation', 'explicit'],
    ]);
  });

  it('position inference: core, services, adapters', () => {
    expect(kinds([layer('core'), layer('services'), layer('adapters')])).toEqual([
      ['core', 'domain', 'position'],
      ['services', 'application', 'position'],
      ['adapters', 'infrastructure', 'position'],
    ]);
  });

  it('2 layers: domain and infrastructure, no application', () => {
    expect(kinds([layer('inner'), layer('outer')])).toEqual([
      ['inner', 'domain', 'position'],
      ['outer', 'infrastructure', 'position'],
    ]);
  });

  it('4+ layers: every unnamed middle layer is application', () => {
    expect(kinds([layer('core'), layer('a'), layer('b'), layer('edge')])).toEqual([
      ['core', 'domain', 'position'],
      ['a', 'application', 'position'],
      ['b', 'application', 'position'],
      ['edge', 'infrastructure', 'position'],
    ]);
  });

  it('never infers presentation by position', () => {
    const resolved = resolveLayerKinds([layer('l0'), layer('l1'), layer('l2'), layer('l3'), layer('l4')]).layers;
    expect(resolved.some((l) => l.kind === 'presentation')).toBe(false);
  });

  it('explicit kind wins over a kind-named layer', () => {
    expect(kinds([layer('domain', 'infrastructure'), layer('x')])).toEqual([
      ['domain', 'infrastructure', 'explicit'],
      ['x', 'infrastructure', 'position'],
    ]);
  });

  it('several application layers are not a warning', () => {
    expect(resolveLayerKinds([layer('core'), layer('a'), layer('b'), layer('edge')]).warnings).toEqual([]);
  });

  it('is pure: inputs are not mutated, new objects are returned, other fields kept', () => {
    const input = [{ ...layer('core'), directories: ['src/core'], filePatterns: ['*.ts'] }, layer('edge')];
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    const out = resolveLayerKinds(input).layers;
    expect(input).toEqual(snapshot);
    expect(out[0]).not.toBe(input[0]);
    expect(out[0]).toMatchObject({ directories: ['src/core'], filePatterns: ['*.ts'], kind: 'domain' });
  });
});

describe('duplicate scalar kinds (BR-U1-13)', () => {
  it('core, domain, edge -> exactly one SPEC_005 naming core first', () => {
    const { layers, warnings } = resolveLayerKinds([layer('core'), layer('domain'), layer('edge')]);
    expect(layers.map((l) => [l.kind, l.kindSource])).toEqual([
      ['domain', 'position'], ['domain', 'name'], ['infrastructure', 'position'],
    ]);
    expect(warnings).toEqual([{
      code: 'SPEC_005',
      message: 'Layer kind "domain" resolved for layers core, domain; binding uses core',
    }]);
  });

  it('reports duplicate infrastructure and presentation in scalar-kind order', () => {
    const { warnings } = resolveLayerKinds([
      layer('presentation'), layer('infrastructure'), layer('ui', 'presentation'), layer('db', 'infrastructure'),
    ]);
    expect(warnings.map((w) => w.message)).toEqual([
      'Layer kind "infrastructure" resolved for layers infrastructure, db; binding uses infrastructure',
      'Layer kind "presentation" resolved for layers presentation, ui; binding uses presentation',
    ]);
  });
});
