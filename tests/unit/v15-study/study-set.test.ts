/**
 * The study task set from one manifest (`experiments/v15-study/lib/study-set.ts`, B9) and the scorer's gate (b) input
 * (`score-study.ts`, `newHits`). Zero model calls.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_STUDY_SET, loadStudySet } from '../../../experiments/v15-study/lib/study-set.js';
import { hxCounted, newHits, type Hit } from '../../../experiments/v15-study/score-study.js';

const REPO = path.resolve(__dirname, '../../..');

describe('study set manifest', () => {
  it('the trap-families manifest: every task under experiments/trap-families, the confirmatory order kept', () => {
    const s = loadStudySet(REPO);
    const doc = JSON.parse(fs.readFileSync(path.join(REPO, DEFAULT_STUDY_SET), 'utf8')) as { confirmatory: { ddd: string[]; hexagonal: string[] } };
    expect(s.ids).toEqual([...doc.confirmatory.ddd, ...doc.confirmatory.hexagonal]);
    expect(s.roots).toEqual(['experiments/trap-families']);
    expect(s.dirOf('f2-hex-vendor-port')).toBe('experiments/trap-families/f2-hex-vendor-port');
  });

  it('the Hexagonal study manifest: 13 tasks over three roots, part A and the four trap-family tasks on disk', () => {
    const s = loadStudySet(REPO, 'experiments/hx-study-set/study-set.json');
    expect(s.ids).toHaveLength(13);
    expect(s.confirmatory.ddd).toEqual([]);
    expect(s.ids.filter((t) => t.startsWith('hxa') || t.startsWith('hxb'))).toHaveLength(5);
    expect(s.ids.filter((t) => t.startsWith('hxpb'))).toEqual(['hxpb1-pottery-kiln', 'hxpb2-translation-portal', 'hxpb3-observatory-evenings', 'hxpb4-chess-entries']);
    expect(s.ids.filter((t) => t.startsWith('f'))).toEqual(['f2-hex-vendor-port', 'f14-hex-geocoding', 'f16-hex-fx-rates', 'f24-hex-laundry-lockers']);
    expect(s.roots).toEqual(['experiments/hx-study-set/part-a', 'experiments/hx-study-set/part-b', 'experiments/trap-families']);
    for (const t of s.ids) {
      expect(path.posix.basename(s.dirOf(t))).toBe(t);
      if (!t.startsWith('hxpb')) {
        expect(fs.existsSync(path.join(REPO, s.dirOf(t), 'tasks.json'))).toBe(true);
        expect((JSON.parse(fs.readFileSync(path.join(REPO, s.dirOf(t), 'puzzle.json'), 'utf8')) as { style: string }).style).toBe('hexagonal');
      }
    }
  });

  it('a task without a taskDirs entry lives beside the manifest; malformed manifests are refused', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'study-set-'));
    try {
      fs.mkdirSync(path.join(tmp, 'm'));
      const w = (doc: unknown): void => { fs.writeFileSync(path.join(tmp, 'm', 'set.json'), JSON.stringify(doc)); };
      w({ confirmatory: { ddd: ['a'], hexagonal: ['b'] }, exploratory: { hexagonal: ['c'] }, taskDirs: { b: 'x/y/b/' } });
      const s = loadStudySet(tmp, 'm/set.json');
      expect(s.ids).toEqual(['a', 'b', 'c']);
      expect([s.dirOf('a'), s.dirOf('b'), s.dirOf('c')]).toEqual(['m/a', 'x/y/b', 'm/c']);
      expect(() => s.dirOf('z')).toThrow('unknown task z');
      w({ confirmatory: { ddd: ['a'], hexagonal: ['a'] } });
      expect(() => loadStudySet(tmp, 'm/set.json')).toThrow('listed twice');
      w({ confirmatory: { ddd: ['a'], hexagonal: [] }, taskDirs: { q: 'q' } });
      expect(() => loadStudySet(tmp, 'm/set.json')).toThrow('not in the set');
      w({ confirmatory: { ddd: ['a'], hexagonal: [] }, taskDirs: { a: '../out' } });
      expect(() => loadStudySet(tmp, 'm/set.json').dirOf('a')).toThrow('repository-relative');
      expect(() => loadStudySet(tmp, '../m/set.json')).toThrow('repository-relative');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe('scorer gate (b) input', () => {
  const h = (rule: string, file: string, subject: string, line: number | null, extra: Partial<Hit> = {}): Hit => ({ rule, file, subject, line, source: 'v15', ...extra });
  it('newHits keeps the identities the seed lacks, sorted, each marked counted by the option', () => {
    const seed = [h('R-AXA', 'src/a.ts', 'A', 3)];
    const now = [h('R-MIRROR2', 'src/m.ts', 'M', 1, { shape: 'field' }), h('R-AXA', 'src/a.ts', 'A', 9), h('R-MIRROR2', 'src/m.ts', 'L', 2, { shape: 'literal' }), h('FF-S01', 'src/b.ts', 'B', 4, { source: 'frozen' })];
    const out = newHits(now, seed, (x) => hxCounted(x, 'i'));
    expect(out.map((x) => [x.rule, x.subject, x.counted])).toEqual([['FF-S01', 'B', true], ['R-MIRROR2', 'M', false], ['R-MIRROR2', 'L', true]]);
    expect(out[2]).toEqual({ rule: 'R-MIRROR2', file: 'src/m.ts', subject: 'L', line: 2, source: 'v15', shape: 'literal', counted: true });
  });
});
