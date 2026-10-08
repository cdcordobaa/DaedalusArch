/**
 * Deterministic warning merge and cap (FR-13, FR-34, FR-35; U3 BR-U3-57, BR-U3-70 items 1 and 10; TF-19).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  REPORT_STAGE, WARNING_CAP_PER_CODE, WARNING_STAGE_ORDER, canonicalJson, compareWarnings, mergeWarnings,
} from '../../../src/scoring-engine/warning-merge.js';
import type { PipelineWarning } from '../../../src/shared/errors/domain-result.js';
import { scrubWarning } from '../../../src/shared/errors/scrub.js';

const identity = (w: PipelineWarning): PipelineWarning => w;

function shuffled<T>(items: readonly T[], seed: number): T[] {
  let s = seed;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

function flood(n: number): PipelineWarning[] {
  return Array.from({ length: n }, (_, i) => ({
    stage: 'extract-apg',
    code: 'EXTRACTOR_009',
    message: `Unsupported dynamic import(s): 1 in src/f${String(i).padStart(3, '0')}.ts`,
  }));
}

function specWarnings(n: number): PipelineWarning[] {
  return Array.from({ length: n }, (_, i) => ({
    stage: 'parse-spec', code: 'SPEC_002', message: `function ${String(i).padStart(2, '0')} uses a default`,
  }));
}

describe('mergeWarnings cap (BR-U3-57, BR-U3-70 item 1)', () => {
  it('freezes the cap at 50', () => {
    expect(WARNING_CAP_PER_CODE).toBe(50);
  });

  it('TF-19: 120 EXTRACTOR_009 give 50 shown plus one REPORT_001 {total 120, shown 50}', () => {
    const out = mergeWarnings(flood(120), identity);
    expect(out).toHaveLength(51);
    expect(out.slice(0, 50).every((w) => w.code === 'EXTRACTOR_009')).toBe(true);
    expect(out[50]).toEqual({
      stage: REPORT_STAGE,
      code: 'REPORT_001',
      message: 'EXTRACTOR_009 from extract-apg: showing 50 of 120',
      context: { stage: 'extract-apg', code: 'EXTRACTOR_009', total: 120, shown: 50 },
    });
  });

  it('the cap entry follows the capped pair, before later stages', () => {
    const out = mergeWarnings([...flood(51), ...specWarnings(2), { stage: 'compute-scores', code: 'METRIC_002', message: 'm' }], identity);
    expect(out.map((w) => w.code)).toEqual([
      ...Array<string>(50).fill('EXTRACTOR_009'), 'REPORT_001', 'SPEC_002', 'SPEC_002', 'METRIC_002',
    ]);
  });

  it('26 SPEC_002 stay uncapped', () => {
    const out = mergeWarnings(specWarnings(26), identity);
    expect(out).toHaveLength(26);
    expect(out.some((w) => w.code === 'REPORT_001')).toBe(false);
  });
});

describe('mergeWarnings order (BR-U3-57, BR-U3-70 item 10)', () => {
  const mixed: PipelineWarning[] = [
    ...flood(60),
    ...specWarnings(26),
    { stage: 'compile-functions', code: 'COMPILER_004', message: 'FF-S03 disabled' },
    { stage: 'compute-scores', code: 'METRIC_002', message: 'abstraction ratio undefined', context: { metric: 'abstractionRatio', reason: 'no classes or interfaces' } },
    { stage: 'zz-unknown', code: 'X_1', message: 'later' },
    { stage: 'aa-unknown', code: 'X_1', message: 'later' },
  ];

  it('two shuffled input orders give identical output', () => {
    const reference = mergeWarnings(mixed, identity);
    for (const seed of [1, 2, 3]) {
      expect(mergeWarnings(shuffled(mixed, seed), identity)).toEqual(reference);
    }
  });

  it('sorts by stage rank (pipeline order), unknown stages last by name', () => {
    const stages = mergeWarnings(mixed, identity).map((w) => w.stage);
    const firstIndex = (s: string): number => stages.indexOf(s);
    expect(firstIndex('extract-apg')).toBeLessThan(firstIndex('parse-spec'));
    expect(firstIndex('parse-spec')).toBeLessThan(firstIndex('compile-functions'));
    expect(firstIndex('compile-functions')).toBeLessThan(firstIndex('compute-scores'));
    expect(stages.slice(-2)).toEqual(['aa-unknown', 'zz-unknown']);
  });

  it('equal stage, code and message with different contexts sort by canonical context in both input orders', () => {
    const w1: PipelineWarning = { stage: 'compute-scores', code: 'METRIC_001', message: 'failed', context: { metric: 'maxFanIn', code: 'E' } };
    const w2: PipelineWarning = { stage: 'compute-scores', code: 'METRIC_001', message: 'failed', context: { code: 'E', metric: 'cyclicDependencyCount' } };
    const expected = [w2, w1]; // {"code":"E","metric":"cyclicDependencyCount"} < {"code":"E","metric":"maxFanIn"}
    expect(mergeWarnings([w1, w2], identity)).toEqual(expected);
    expect(mergeWarnings([w2, w1], identity)).toEqual(expected);
    expect(compareWarnings(w1, w2)).toBeGreaterThan(0);
  });

  it('a warning without context sorts as context null', () => {
    const bare: PipelineWarning = { stage: 'compute-scores', code: 'M', message: 'x' };
    const withCtx: PipelineWarning = { ...bare, context: { a: 1 } };
    expect(mergeWarnings([withCtx, bare], identity)).toEqual([bare, withCtx]); // 'null' < '{"a":1}' (code units)
  });

  it('does not mutate its input', () => {
    const input = shuffled(mixed, 9);
    const copy = JSON.parse(JSON.stringify(input)) as PipelineWarning[];
    mergeWarnings(input, identity);
    expect(input).toEqual(copy);
  });
});

describe('scrub hook (BR-U3-58 hook only)', () => {
  it('runs the scrub function on every warning before sorting', () => {
    const secret = 'u3-test-secret-value';
    const out = mergeWarnings(
      [{ stage: 'ingest-apg', code: 'INGEST_001', message: `connect failed with ${secret}`, context: { detail: secret } }],
      (w) => scrubWarning(w, [secret]),
    );
    expect(JSON.stringify(out)).not.toContain(secret);
  });
});

describe('canonicalJson', () => {
  it('sorts object keys recursively and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
  });
});

describe('WARNING_STAGE_ORDER covers every stage in src (static)', () => {
  const SRC = path.resolve(__dirname, '../../../src');
  function tsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return tsFiles(full);
      return e.name.endsWith('.ts') ? [full] : [];
    });
  }
  const files = tsFiles(SRC);

  it("every `stage: '<literal>'` in src/ is in WARNING_STAGE_ORDER", () => {
    const stages = new Set<string>();
    for (const file of files) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/stage:\s*'([^']+)'/g)) {
        if (m[1] !== undefined) stages.add(m[1]);
      }
    }
    expect(stages.size).toBeGreaterThan(5);
    expect([...stages].filter((s) => !WARNING_STAGE_ORDER.includes(s))).toEqual([]);
  });

  it('every pipeline command name (warnings pushed with stage: this.name) is in WARNING_STAGE_ORDER', () => {
    const names = new Set<string>();
    for (const file of files.filter((f) => f.includes(`${path.sep}pipeline${path.sep}`))) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/readonly name = '([^']+)'/g)) {
        if (m[1] !== undefined) names.add(m[1]);
      }
    }
    expect(names.size).toBeGreaterThan(10);
    expect([...names].filter((s) => !WARNING_STAGE_ORDER.includes(s))).toEqual([]);
  });
});
