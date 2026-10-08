/**
 * BR-U1-01 (a): thresholds are frozen. Pins every function `threshold` and the
 * `scoring.thresholds` block of each shipped preset and spec, as they are at `ee32a1f`.
 * Allowed differences: self-spec FF-C03 `threshold` absent or 0.8; `presets/layered.yaml` (K15), whose
 * values equal `presets/clean-architecture.yaml` for the same ids.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');

interface ThresholdView {
  readonly functions: Record<string, number>;
  readonly scoring: unknown;
  readonly ids: readonly string[];
}

const SCORING = { pass: 0.8, warning: 0.65, soft_block: 0.5 };

const CLEAN_ARCH_FUNCTIONS = { 'FF-P02': 0.85, 'FF-C01': 0.3, 'FF-C02': 10, 'FF-C05': 15, 'FF-C06': 0.3 };

const PINNED: Readonly<Record<string, { functions: Record<string, number>; scoring: unknown }>> = {
  'presets/clean-architecture.yaml': { functions: CLEAN_ARCH_FUNCTIONS, scoring: SCORING },
  'presets/nestjs.yaml': {
    functions: { 'FF-P02': 0.85, 'FF-C01': 0.3, 'FF-C02': 12, 'FF-C03': 0.8, 'FF-C05': 20, 'FF-C06': 0.3 },
    scoring: SCORING,
  },
  'specs/clean-arch.yaml': { functions: CLEAN_ARCH_FUNCTIONS, scoring: SCORING },
  'specs/daedalus-arch.yaml': {
    functions: { 'FF-P02': 0.85, 'FF-C01': 0.3, 'FF-C02': 15, 'FF-C05': 20, 'FF-C06': 0.25 },
    scoring: SCORING,
  },
};

const SELF_SPEC = 'specs/daedalus-arch.yaml';
const LAYERED = 'presets/layered.yaml';

function view(rel: string): ThresholdView {
  const raw = YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8')) as {
    fitness_functions?: { id: string; threshold?: number }[];
    scoring?: { thresholds?: unknown };
  };
  const functions: Record<string, number> = {};
  const ids: string[] = [];
  for (const ff of raw.fitness_functions ?? []) {
    ids.push(ff.id);
    if (ff.threshold != null) functions[ff.id] = ff.threshold;
  }
  return { functions, scoring: raw.scoring?.thresholds, ids };
}

function yamlFiles(): string[] {
  return ['presets', 'specs'].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => `${dir}/${f}`),
  ).sort();
}

describe('frozen thresholds (BR-U1-01 a)', () => {
  it('every shipped YAML is pinned (layered.yaml is checked against clean-architecture)', () => {
    const unpinned = yamlFiles().filter((f) => !(f in PINNED) && f !== LAYERED);
    expect(unpinned).toEqual([]);
  });

  it.each(Object.keys(PINNED))('%s keeps its thresholds', (rel) => {
    const actual = view(rel);
    const functions = { ...actual.functions };
    if (rel === SELF_SPEC && functions['FF-C03'] === 0.8) delete functions['FF-C03'];
    expect(functions).toEqual(PINNED[rel]?.functions);
    expect(actual.scoring).toEqual(PINNED[rel]?.scoring);
  });

  it('presets/layered.yaml (K15) declares the clean-architecture ids with equal thresholds', () => {
    expect(fs.existsSync(path.join(ROOT, LAYERED))).toBe(true);
    const layered = view(LAYERED);
    const clean = view('presets/clean-architecture.yaml');
    expect(layered.ids).toEqual(clean.ids);
    expect(layered.functions).toEqual(CLEAN_ARCH_FUNCTIONS);
    for (const id of layered.ids.filter((i) => clean.ids.includes(i))) {
      expect({ id, threshold: layered.functions[id] }).toEqual({ id, threshold: clean.functions[id] });
    }
    expect(layered.scoring).toEqual(clean.scoring);
  });
});
