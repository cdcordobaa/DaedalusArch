import { isTemplateApplicable } from '../../../src/fitness-compiler/template-applicability.js';
import type { CypherTemplate, LayerKindBinding } from '../../../src/fitness-compiler/types.js';
import type { LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';

function template(overrides: Partial<CypherTemplate> = {}): CypherTemplate {
  return {
    functionName: 'some-template',
    template: 'MATCH (n) RETURN n',
    requiredParams: [],
    optionalParams: [],
    description: 'test',
    resultMapping: { filePathColumn: 'filePath', messageTemplate: 'x', discriminatorColumns: [] },
    requiredLayerKinds: [],
    tag: 'structural',
    ...overrides,
  };
}

function model(names: string[], filePatterns = false): LayerModel {
  return {
    layers: names.map((name): LayerDefinition => ({
      name, directories: [], naming: [], role: 'x', ...(filePatterns ? { filePatterns: ['*.ts'] } : {}),
    })),
  };
}

const FULL: LayerKindBinding = {
  domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'infrastructure', presentationLayer: 'ui',
};
const THREE = model(['domain', 'application', 'infrastructure']);
const LAYER_COUNT_REASON_2 =
  'Auto-disabled: only 2 layer(s) defined with no file_patterns — no intermediate layer to skip';

describe('isTemplateApplicable (BR-U1-10, BR-U1-15, BR-U1-18)', () => {
  it('applicable when no check fails', () => {
    expect(isTemplateApplicable(template(), 'clean-architecture', FULL, THREE)).toEqual({ applicable: true });
  });

  describe('(a) style', () => {
    const restricted = template({ applicableStyles: ['clean-architecture', 'nestjs'] });

    it('disables a listed-style template for another style', () => {
      expect(isTemplateApplicable(restricted, 'layered', FULL, THREE))
        .toEqual({ applicable: false, reason: 'not applicable to style layered' });
    });

    it('keeps it for a listed style', () => {
      expect(isTemplateApplicable(restricted, 'nestjs', FULL, THREE)).toEqual({ applicable: true });
    });

    it('ignores applicableStyles when style is undefined', () => {
      expect(isTemplateApplicable(restricted, undefined, FULL, THREE)).toEqual({ applicable: true });
    });

    it('a template without applicableStyles applies to every style', () => {
      expect(isTemplateApplicable(template(), 'layered', FULL, THREE)).toEqual({ applicable: true });
    });
  });

  describe('(b) layer kinds', () => {
    it.each<[LayerKind, LayerKindBinding]>([
      ['domain', { applicationLayers: ['a'], infraLayer: 'i', presentationLayer: 'p' }],
      ['application', { domainLayer: 'd', applicationLayers: [], infraLayer: 'i', presentationLayer: 'p' }],
      ['infrastructure', { domainLayer: 'd', applicationLayers: ['a'], presentationLayer: 'p' }],
      ['presentation', { domainLayer: 'd', applicationLayers: ['a'], infraLayer: 'i' }],
    ])('no %s layer', (kind, binding) => {
      expect(isTemplateApplicable(template({ requiredLayerKinds: [kind] }), undefined, binding, THREE))
        .toEqual({ applicable: false, reason: `no ${kind} layer` });
    });

    it('names the first missing kind in requiredLayerKinds order', () => {
      const t = template({ requiredLayerKinds: ['domain', 'application', 'infrastructure'] });
      expect(isTemplateApplicable(t, undefined, { domainLayer: 'd', applicationLayers: [] }, THREE))
        .toEqual({ applicable: false, reason: 'no application layer' });
    });

    it('an empty requiredLayerKinds needs no bound layer', () => {
      expect(isTemplateApplicable(template(), undefined, { applicationLayers: [] }, THREE))
        .toEqual({ applicable: true });
    });
  });

  describe('(c) no-layer-skip layer count', () => {
    const skip = template({ functionName: 'no-layer-skip' });

    it('keeps today\'s reason text for 2 layers without file_patterns', () => {
      expect(isTemplateApplicable(skip, undefined, FULL, model(['domain', 'infrastructure'])))
        .toEqual({ applicable: false, reason: LAYER_COUNT_REASON_2 });
    });

    it('applies with file_patterns or 3+ layers', () => {
      expect(isTemplateApplicable(skip, undefined, FULL, model(['a', 'b'], true))).toEqual({ applicable: true });
      expect(isTemplateApplicable(skip, undefined, FULL, THREE)).toEqual({ applicable: true });
    });

    it('applies only to no-layer-skip', () => {
      expect(isTemplateApplicable(template(), undefined, FULL, model(['a', 'b']))).toEqual({ applicable: true });
    });
  });

  describe('check order', () => {
    const all = template({
      functionName: 'no-layer-skip', applicableStyles: ['layered'], requiredLayerKinds: ['application'],
    });
    const noApp: LayerKindBinding = { domainLayer: 'd', applicationLayers: [], infraLayer: 'i' };
    const two = model(['d', 'i']);

    it('style before kinds before layer count', () => {
      expect(isTemplateApplicable(all, 'nestjs', noApp, two))
        .toEqual({ applicable: false, reason: 'not applicable to style nestjs' });
      expect(isTemplateApplicable(all, 'layered', noApp, two))
        .toEqual({ applicable: false, reason: 'no application layer' });
      expect(isTemplateApplicable(all, 'layered', FULL, two))
        .toEqual({ applicable: false, reason: LAYER_COUNT_REASON_2 });
    });
  });
});
