import * as path from 'node:path';
import { findOutliers } from '../../../src/ise/outliers.js';
import { loadIsePreset } from '../../../src/ise/preset.js';
import type { IseStyle } from '../../../src/ise/style-classifier.js';
import { cleanShaped, graph } from './helpers.js';

const presetOf = (s: IseStyle): ReturnType<typeof loadIsePreset> => loadIsePreset(s, path.resolve('presets'));

describe('ISE Option 3 (outlier edges, no spec)', () => {
  it('finds no outlier in a project that follows its own order', () => {
    expect(findOutliers(cleanShaped(), presetOf).outliers).toEqual([]);
  });

  it('flags an import against the inferred layer order', () => {
    const base = cleanShaped();
    const g = graph({
      files: [...base.files],
      edges: [...base.edges.map((e) => `${e.from}>${e.to}`), 'src/domain/entities/Book.ts>src/application/ports/Clock.ts'],
    });
    const r = findOutliers(g, presetOf);
    expect(r.style).toBe('clean-architecture');
    expect(r.outliers).toEqual([
      { file: 'src/domain/entities/Book.ts', target: 'src/application/ports/Clock.ts', reason: 'against-order', fromLayer: 'domain', toLayer: 'application' },
    ]);
  });
});
