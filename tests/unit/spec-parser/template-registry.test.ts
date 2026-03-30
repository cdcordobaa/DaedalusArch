import { resolveTemplate, TEMPLATE_REGISTRY } from '../../../src/spec-parser/template-registry.js';

describe('template-registry', () => {
  describe('TEMPLATE_REGISTRY', () => {
    it('contains clean-architecture template', () => {
      expect(TEMPLATE_REGISTRY.has('clean-architecture')).toBe(true);
    });

    it('clean-architecture has 26 functions', () => {
      const template = TEMPLATE_REGISTRY.get('clean-architecture')!;
      expect(template.functions).toHaveLength(26);
    });

    it('has 24 symbolic + 2 neuronal/hybrid functions', () => {
      const template = TEMPLATE_REGISTRY.get('clean-architecture')!;
      const symbolic = template.functions.filter((f) => f.route === 'symbolic');
      const hybrid = template.functions.filter((f) => f.route === 'hybrid');
      const neuronal = template.functions.filter((f) => f.route === 'neuronal');
      expect(symbolic).toHaveLength(24);
      expect(hybrid).toHaveLength(1); // FF-N01 srp-semantic
      expect(neuronal).toHaveLength(1); // FF-N02 layering-intent
    });

    it('all functions are marked isBuiltIn', () => {
      const template = TEMPLATE_REGISTRY.get('clean-architecture')!;
      expect(template.functions.every((f) => f.isBuiltIn)).toBe(true);
    });

    it('default weights sum to 1.0', () => {
      const template = TEMPLATE_REGISTRY.get('clean-architecture')!;
      const w = template.defaultWeights;
      const sum = w.structural + w.coupling + w.pattern + w.solid + w.convention + w.semantic + w.intent;
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('full mode weights sum to 1.0', () => {
      const template = TEMPLATE_REGISTRY.get('clean-architecture')!;
      const w = template.defaultFullModeWeights;
      const sum = w.structural + w.coupling + w.pattern + w.solid + w.convention + w.semantic + w.intent;
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('verdict thresholds are properly ordered', () => {
      const template = TEMPLATE_REGISTRY.get('clean-architecture')!;
      const t = template.defaultVerdictThresholds;
      expect(t.pass).toBeGreaterThan(t.warning);
      expect(t.warning).toBeGreaterThan(t.softBlock);
      expect(t.softBlock).toBeGreaterThan(0);
    });
  });

  describe('resolveTemplate', () => {
    it('resolves clean-architecture', () => {
      const template = resolveTemplate('clean-architecture');
      expect(template).toBeDefined();
      expect(template!.style).toBe('clean-architecture');
    });

    it('resolves case-insensitively', () => {
      const template = resolveTemplate('Clean-Architecture');
      expect(template).toBeDefined();
    });

    it('returns undefined for unknown style', () => {
      const template = resolveTemplate('hexagonal');
      expect(template).toBeUndefined();
    });
  });
});
