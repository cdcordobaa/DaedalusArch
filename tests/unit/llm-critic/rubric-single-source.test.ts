/**
 * U4-K6 (Step 26): FF-N01/FF-N02 rubric text and names have one source, `src/llm-critic/rubric.ts`
 * (BR-U4-RUB-01, RUB-02; FR-22; U1 Q12 A; T20). The five shipped YAMLs and every FF-N01/FF-N02 entry of
 * every registry template (enumerated, never a line range) carry byte-identical text; the old names and
 * the SRP rubric are gone; the frozen strings hold no probe-construction vocabulary (RUB-01).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';
import {
  FF_N01_ID, FF_N01_NAME, FF_N01_RUBRIC, FF_N02_ID, FF_N02_NAME, FF_N02_RUBRIC,
  PROBE_CONSTRUCTION_VOCABULARY, RETIRED_RUBRIC_NAMES, RUBRIC_OUT_OF_SCOPE,
} from '../../../src/llm-critic/rubric.js';
import type { RubricText } from '../../../src/llm-critic/rubric.js';
import { TEMPLATE_REGISTRY } from '../../../src/spec-parser/template-registry.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';

const ROOT = path.resolve(__dirname, '../../..');
const YAMLS = [
  'presets/clean-architecture.yaml',
  'presets/nestjs.yaml',
  'presets/layered.yaml',
  'specs/clean-arch.yaml',
  'specs/daedalus-arch.yaml',
] as const;
const REGISTRY_FILE = 'src/spec-parser/template-registry.ts';

const EXPECTED: readonly (readonly [string, string, RubricText])[] = [
  [FF_N01_ID, FF_N01_NAME, FF_N01_RUBRIC],
  [FF_N02_ID, FF_N02_NAME, FF_N02_RUBRIC],
];

interface YamlFn {
  id?: unknown; name?: unknown;
  semantic_criteria?: { rule?: unknown; rubric?: { pass?: unknown; fail?: unknown; evidence_required?: unknown } };
}

function yamlFunctions(rel: string): YamlFn[] {
  const doc = parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8')) as { fitness_functions?: YamlFn[] };
  return doc.fitness_functions ?? [];
}

describe('BR-U4-RUB-02: one source for FF-N01/FF-N02 name and semantic_criteria', () => {
  it('the registry has the three templates the design names', () => {
    expect([...TEMPLATE_REGISTRY.keys()].sort()).toEqual(['clean-architecture', 'layered', 'nestjs']);
  });

  const registryCases = [...TEMPLATE_REGISTRY.entries()].flatMap(([style, t]) =>
    EXPECTED.map(([id, name, rubric]) => [style, id, name, rubric, t] as const));

  it.each(registryCases)('registry %s %s: name and semantic criteria from rubric.ts', (_style, id, name, rubric, t) => {
    const fns = t.functions.filter((f) => String(f.id) === id);
    expect(fns).toHaveLength(1);
    const fn = fns[0];
    expect(fn?.name).toBe(name);
    expect(fn?.semanticCriteria).toEqual({
      rule: rubric.rule,
      rubric: { pass: rubric.pass, fail: rubric.fail, evidenceRequired: rubric.evidenceRequired },
    });
  });

  const yamlCases = YAMLS.flatMap((rel) => EXPECTED.map(([id, name, rubric]) => [rel, id, name, rubric] as const));

  it.each(yamlCases)('%s %s: name and semantic_criteria byte-identical to rubric.ts', (rel, id, name, rubric) => {
    const fns = yamlFunctions(rel).filter((f) => f.id === id);
    expect(fns).toHaveLength(1);
    const fn = fns[0];
    expect(fn?.name).toBe(name);
    expect(fn?.semantic_criteria).toEqual({
      rule: rubric.rule,
      rubric: { pass: rubric.pass, fail: rubric.fail, evidence_required: rubric.evidenceRequired },
    });
  });

  it.each(YAMLS)('%s: the parsed spec carries the rubric text unchanged', async (rel) => {
    const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
    if (!r.success) throw new Error(`${rel} did not parse`);
    for (const [id, name, rubric] of EXPECTED) {
      const fn = r.data.fitnessFunctions.find((f) => String(f.id) === id);
      expect(fn?.name).toBe(name);
      expect(fn?.semanticCriteria?.rule).toBe(rubric.rule);
      expect(fn?.semanticCriteria?.rubric).toMatchObject({
        pass: rubric.pass, fail: rubric.fail, evidenceRequired: rubric.evidenceRequired,
      });
    }
  });
});

describe('BR-U4-RUB-01: grep over the five YAMLs and the registry', () => {
  const files = [...YAMLS, REGISTRY_FILE];

  it.each(files)('%s: no retired name, no SRP rubric text', (rel) => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
    for (const old of RETIRED_RUBRIC_NAMES) expect(text).not.toContain(old);
    expect(text.toLowerCase()).not.toContain('reason to change');
  });

  it.each(YAMLS)('%s: no SRP text under integrity (FF-N01 and every integrity function)', (rel) => {
    for (const fn of yamlFunctions(rel).filter((f) => (f as { dimension?: unknown }).dimension === 'integrity')) {
      expect(JSON.stringify(fn.semantic_criteria ?? {}).toLowerCase()).not.toMatch(/single (purpose|reason)|one reason/);
    }
  });

  it('the frozen strings contain no probe-construction vocabulary (MO-X02, MO-X03)', () => {
    const all = [FF_N01_RUBRIC, FF_N02_RUBRIC]
      .flatMap((r) => [r.rule, r.pass, r.fail, r.evidenceRequired])
      .concat(RUBRIC_OUT_OF_SCOPE)
      .join('\n')
      .toLowerCase();
    for (const word of PROBE_CONSTRUCTION_VOCABULARY) expect(all).not.toContain(word);
  });
});
