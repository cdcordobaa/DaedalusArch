import { normaliseDimension } from '../../../src/spec-parser/dimension-alias.js';
import type { Dimension } from '../../../src/shared/types/enums.js';

describe('normaliseDimension (FR-22, BR-U1-20)', () => {
  it('maps intent to semantic with one SPEC_004', () => {
    expect(normaliseDimension('intent', 'FF-N02')).toEqual({
      dimension: 'semantic',
      warning: { code: 'SPEC_004', message: 'Dimension "intent" of FF-N02 is deprecated; mapped to "semantic"' },
    });
  });

  it.each<Dimension>(['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'integrity'])(
    'passes %s through without a warning', (d) => {
      const r = normaliseDimension(d, 'FF-X01');
      expect(r).toEqual({ dimension: d });
      expect('warning' in r).toBe(false);
    },
  );
});
