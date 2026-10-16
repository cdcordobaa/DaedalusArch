/**
 * The synthetic hold-out stand-in (scripts/v1.3/lib/synthetic-holdout.ts): generated from the development set, it has
 * the hold-out structure, needs the id map for its provisional ddd id, and carries exactly one planted miss.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateSyntheticHoldout } from '../../../../scripts/v1.3/lib/synthetic-holdout.js';
import { checkStructure, sealedTreeSha256 } from '../../../../scripts/v1.3/lib/holdout-run-main.js';

const ROOT = path.resolve(__dirname, '../../../..');
let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-synthetic-test-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

it('generates a stand-in that passes the structure check only with its id map, with one planted miss', () => {
  const out = path.join(tmp, 'v1.3-holdout');
  const r = generateSyntheticHoldout(path.join(ROOT, 'tests/fixtures/v1.3-reference'), out);
  expect(r.renamed).toBe(66);
  expect(r.plantedMiss).toMatchObject({ style: 'clean-architecture', ruleId: 'FF-S01', target: 'src/infrastructure/main.ts' });
  expect(fs.readdirSync(path.join(out, 'layered', 'variants')).filter((v) => v !== 'clean').every((v) => /^[vng]\d\d-syn-/.test(v))).toBe(true);

  const without = checkStructure(ROOT, { holdout: out, standIn: false, deferred: [] });
  expect(without.problems).toEqual(['ddd: rule ids not in the frozen spec: FF-D01 (provisional ids? give --id-map)']);

  const map = path.join(tmp, 'id-map.json');
  fs.writeFileSync(map, JSON.stringify(r.idMap));
  const s = checkStructure(ROOT, { holdout: out, idMap: map, standIn: false, deferred: [], expectSha256: sealedTreeSha256(out) });
  expect(s.problems).toEqual([]);
  expect(s.styles.map((x) => [x.style, x.expectedBlocking])).toEqual([
    ['clean-architecture', 14], ['layered', 11], ['nestjs', 11], ['hexagonal', 13], ['ddd', 9],
  ]);
  expect(s.styles.find((x) => x.style === 'ddd')?.mappedIds).toEqual({ 'FF-D01 -> FF-DT01': 1 });
  expect(() => generateSyntheticHoldout(path.join(ROOT, 'tests/fixtures/v1.3-reference'), out)).toThrow(/exists/);
}, 120_000);
