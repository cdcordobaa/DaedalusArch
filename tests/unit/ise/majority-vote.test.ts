import { applyRules, mineRules, newDeviations, unitOfPath } from '../../../src/ise/majority-vote.js';
import { unitStructure } from '../../../src/ise/units.js';
import { cleanShaped, graph } from './helpers.js';

describe('ISE Option 1 (majority vote)', () => {
  const g = cleanShaped();
  const s = unitStructure(g);
  const rules = mineRules(g, s);

  it('encodes the majority direction of each unit pair and the observed dependencies of each unit', () => {
    const dir = rules.filter((r) => r.kind === 'direction');
    expect(dir.map((r) => [r.from, r.to, r.support, r.applies])).toEqual([
      ['src/domain/', 'src/application/', 1, true],
      ['src/application/', 'src/infrastructure/', 1, true],
      ['src/domain/', 'src/infrastructure/', 1, true],
    ]);
    expect(rules.find((r) => r.kind === 'closed-world' && r.unit === 'src/domain/')?.allowed).toEqual([]);
  });

  it('applies a rule only at or above the threshold', () => {
    const inj = rules.find((r) => r.kind === 'inject-interfaces');
    expect(inj?.support).toBe(1);
    const mixed = graph({
      files: ['src/a/A.ts', 'src/b/B1.ts', 'src/b/B2.ts', 'src/b/I.ts'],
      classes: ['src/a/A.ts', 'src/b/B1.ts', 'src/b/B2.ts'],
      interfaces: ['src/b/I.ts'],
      typeEdges: [['injects', 'src/a/A.ts', 'src/b/B1.ts'], ['injects', 'src/a/A.ts', 'src/b/B2.ts'], ['injects', 'src/a/A.ts', 'src/b/I.ts']],
    });
    const r = mineRules(mixed, unitStructure(mixed)).find((x) => x.kind === 'inject-interfaces');
    expect(r?.support).toBeCloseTo(1 / 3);
    expect(r?.applies).toBe(false);
  });

  it('flags a planted inward-to-outward import, a framework import, a cycle and a concrete injection as new deviations', () => {
    const before = applyRules(rules, g, s.units);
    expect(before).toEqual([]);
    const planted = graph({
      files: [...g.files],
      edges: [...g.edges.map((e) => `${e.from}>${e.to}`), 'src/domain/entities/Book.ts>src/infrastructure/system/SystemClock.ts', 'src/domain/entities/Book.ts>src/domain/repositories/BookRepository.ts'],
      packages: [['src/domain/entities/Book.ts', 'typeorm']],
      classes: ['src/domain/entities/Book.ts', 'src/application/use-cases/RegisterBook.ts', 'src/infrastructure/persistence/InMemoryBookRepository.ts', 'src/infrastructure/system/SystemClock.ts'],
      interfaces: ['src/domain/repositories/BookRepository.ts', 'src/application/ports/Clock.ts'],
      typeEdges: [['injects', 'src/application/use-cases/RegisterBook.ts', 'src/infrastructure/persistence/InMemoryBookRepository.ts']],
    });
    const kinds = new Set(newDeviations(applyRules(rules, planted, s.units), before).map((d) => d.kind));
    expect([...kinds].sort()).toEqual(['acyclic', 'closed-world', 'direction', 'framework-free', 'implements-port', 'inject-interfaces']);
  });

  it('resolves files of a later version to the mined units by longest prefix', () => {
    expect(unitOfPath('src/domain/new/X.ts', s.units)).toBe('src/domain/');
    expect(unitOfPath('src/utils/x.ts', s.units)).toBeUndefined();
  });
});
