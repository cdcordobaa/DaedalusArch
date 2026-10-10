/**
 * Frozen-instrument exporter (ADR-015 item 2; BR-U5b-52; BR-U1-02, 16; BR-U3-70; U5b domain-entities §7).
 *
 * Writes `FrozenInstrument` from code, never by hand:
 * - `PATTERN_GRAMMAR`, `MAX_CYCLE_LENGTH`, `CYCLE_ROW_CAP` (U1 constants);
 * - the applicability table: `isTemplateApplicable` over every compiled template × the four style columns of
 *   U1 BR-U1-18 (clean-architecture, nestjs, layered, no style), each with the U1 K4 layer model of that column;
 * - `tags`: `getTemplateTag` over every template (operational tag definitions, ADR-015 item 9);
 * - `roleExemptions`: the instrument version and the library-level role exemptions per template (ADR-026);
 * - the self-spec deviations of BR-U1-16, values read from `specs/daedalus-arch.yaml`;
 * - U3's frozen verdict source per mode and the `ahsNeuronal` weight rule (BR-U3-70 item 4), from C8;
 * - U4's judge freeze: `FROZEN_VALUES` of `src/llm-critic/frozen.ts` verbatim with its `FROZEN_SHA256` anchor
 *   (U4 business-rules §11, BR-U4-POL-01); `--final` refuses when no judge freeze is supplied;
 * - the metric-key readiness flags of BR-U5b-16, read from the three metric templates' Cypher and result mapping.
 *
 * The same commit always exports the same bytes (canonical JSON; no timestamp, no path).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  CYCLE_ROW_CAP, CYPHER_TEMPLATES, getTemplateTag, listTemplatesByTag, MAX_CYCLE_LENGTH, TEMPLATE_DISCRIMINATORS,
} from '../src/fitness-compiler/cypher-templates.js';
import { bindLayerParams } from '../src/fitness-compiler/layer-binding.js';
import { isTemplateApplicable } from '../src/fitness-compiler/template-applicability.js';
import { inModeDimensions, verdictSourceOf } from '../src/scoring-engine/score-computer.js';
import { PROPORTIONAL_RULE_ID } from '../src/scoring-engine/neural-aggregation.js';
import { PATTERN_GRAMMAR } from '../src/spec-parser/spec-schema.js';
import { FROZEN_SHA256, FROZEN_VALUES } from '../src/llm-critic/frozen.js';
import type { EvaluationMode, LayerKind, TemplateTag } from '../src/shared/types/enums.js';
import type { LayerModel } from '../src/shared/types/spec.js';
import { canonicalize } from './lib/canonical-json.js';
import { INSTRUMENT_VERSION, ROLE_EXEMPTIONS } from '../src/fitness-compiler/role-exemptions.js';

export const SELF_SPEC = 'specs/daedalus-arch.yaml';
export const FROZEN_INSTRUMENT_FILE = 'corpus/frozen-instrument.json';
export const FROZEN_EXPORT_FINAL_REFUSED = 'FROZEN_EXPORT_FINAL_REFUSED';
export const FROZEN_EXPORT_SELF_SPEC = 'FROZEN_EXPORT_SELF_SPEC';

export interface ApplicabilityRow {
  readonly template: string; readonly style: string; readonly applicable: boolean; readonly reason?: string;
}
export interface MetricKeyReadiness { readonly projectLevelKeys: boolean; readonly rowFilters: boolean }
export interface ScoringFreeze {
  readonly verdictSource: Readonly<Record<EvaluationMode, string>>;
  readonly ahsNeuronal: { readonly weights: 'fullModeWeights'; readonly dimensions: readonly string[]; readonly renormalised: true };
  /** ADR-028: the registered neural aggregation (primary) and the registered sensitivity variant (`Docs/analysis-plan.md` §12). */
  readonly neuralAggregation: NeuralAggregationFreeze;
}
export interface NeuralAggregationFreeze {
  readonly primary: 'registered';
  readonly registeredRule: string;
  readonly variants: { readonly proportional: {
    readonly rule: typeof PROPORTIONAL_RULE_ID;
    readonly strata: 'layer';
    readonly unitWeight: 'N_h / V_h';
    readonly failedUnitScore: 'u3-confidence-weight';
    readonly splitVoteScore: 0;
    readonly invalidUnits: 'excluded-stratum-reweighted';
  } };
}
export interface FrozenInstrument {
  readonly patternGrammar: string;
  readonly maxCycleLength: number;
  readonly cycleRowCap: number;
  readonly applicability: readonly ApplicabilityRow[];
  readonly tags: Readonly<Record<string, TemplateTag>>;
  readonly selfSpecDeviations: readonly string[];
  readonly scoringFreeze: ScoringFreeze;
  /** U4 Section 5.2 values verbatim (`{ frozenSha256, values }`); `null` only when a caller supplies none. */
  readonly judgeFreeze: unknown;
  readonly metricKeyReadiness: MetricKeyReadiness;
  /** Instrument v2 role exemptions (ADR-026): the instrument version and the exemption globs per template. */
  readonly roleExemptions: { readonly instrumentVersion: number; readonly templates: Readonly<Record<string, readonly string[]>> };
}

// ---------------------------------------------------------------------------------------------
// Applicability (BR-U1-18 columns with the U1 K4 layer models)

function layerModel(layers: readonly (readonly [string, LayerKind])[]): LayerModel {
  return {
    layers: layers.map(([name, kind]) => ({ name, directories: [], naming: [], role: 'r', kind, kindSource: 'explicit' as const })),
  };
}

const CLEAN = layerModel([['domain', 'domain'], ['application', 'application'], ['infrastructure', 'infrastructure']]);
export const STYLE_COLUMNS: readonly { readonly style: string; readonly declared: string | undefined; readonly model: LayerModel }[] = [
  { style: 'clean-architecture', declared: 'clean-architecture', model: CLEAN },
  {
    style: 'nestjs', declared: 'nestjs',
    model: layerModel([['domain', 'domain'], ['infrastructure', 'infrastructure'], ['application', 'application'], ['presentation', 'presentation']]),
  },
  { style: 'layered', declared: 'layered', model: layerModel([['persistence', 'infrastructure'], ['business', 'domain'], ['presentation', 'presentation']]) },
  { style: 'none', declared: undefined, model: CLEAN },
];

export function applicabilityTable(): ApplicabilityRow[] {
  const rows: ApplicabilityRow[] = [];
  for (const [name, template] of [...CYPHER_TEMPLATES.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    for (const col of STYLE_COLUMNS) {
      const a = isTemplateApplicable(template, col.declared, bindLayerParams(col.model.layers), col.model);
      rows.push(a.applicable ? { template: name, style: col.style, applicable: true } : { template: name, style: col.style, applicable: false, reason: a.reason });
    }
  }
  return rows;
}

/** Template → tag over every compiled template (the union of `listTemplatesByTag` equals the registry). */
export function templateTags(): Record<string, TemplateTag> {
  const tags: Record<string, TemplateTag> = {};
  for (const name of [...CYPHER_TEMPLATES.keys()].sort()) {
    const tag = getTemplateTag(name);
    if (tag !== undefined) tags[name] = tag;
  }
  return tags;
}

export function allTemplateIds(): string[] {
  const tags: TemplateTag[] = ['structural', 'topological', 'pattern-proxy'];
  return [...new Set(tags.flatMap((t) => listTemplatesByTag(t)))].sort();
}

// ---------------------------------------------------------------------------------------------
// Self-spec deviations (BR-U1-16), values from the committed self-spec

/** BR-U1-16 items: (function id, key); plus the `core-modules` layer kind and every `exclude_paths`. */
export const SELF_SPEC_DEVIATION_KEYS: readonly (readonly [string, string])[] = [
  ['FF-C02', 'threshold'], ['FF-C03', 'threshold'], ['FF-C05', 'threshold'], ['FF-C06', 'threshold'],
  ['FF-SO01', 'max_public_methods'], ['FF-SO01', 'max_dependencies'], ['FF-SO02', 'max_interface_methods'],
  ['FF-CV03', 'pattern'], ['FF-CV04', 'pattern'],
];

interface SelfSpecDoc {
  readonly architecture?: { readonly layers?: readonly { readonly name?: string; readonly kind?: string }[] };
  readonly fitness_functions?: readonly Record<string, unknown>[];
}

export function selfSpecDeviations(repoRoot: string): { ok: true; value: string[] } | { ok: false; detail: string } {
  const doc = parseYaml(readFileSync(join(repoRoot, SELF_SPEC), 'utf8')) as SelfSpecDoc;
  const out: string[] = [];
  const core = (doc.architecture?.layers ?? []).find((l) => l.name === 'core-modules');
  if (core?.kind === undefined) return { ok: false, detail: `${SELF_SPEC}: layer core-modules has no kind` };
  out.push(`layer core-modules kind: ${core.kind}`);
  const fns = doc.fitness_functions ?? [];
  const byId = new Map(fns.map((f) => [String(f.id), f]));
  for (const [id, key] of SELF_SPEC_DEVIATION_KEYS) {
    const value = byId.get(id)?.[key];
    if (value === undefined) return { ok: false, detail: `${SELF_SPEC}: ${id} has no ${key}` };
    out.push(`${id} ${key}: ${JSON.stringify(value)}`);
  }
  for (const f of fns) {
    if (Array.isArray(f.exclude_paths)) out.push(`${String(f.id)} exclude_paths: ${JSON.stringify(f.exclude_paths)}`);
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------------------------
// Scoring freeze (BR-U3-70 item 4) and metric-key readiness (BR-U5b-16)

export function scoringFreeze(): ScoringFreeze {
  const modes: EvaluationMode[] = ['symbolic-only', 'neuronal-only', 'full'];
  return {
    verdictSource: Object.fromEntries(modes.map((m) => [m, verdictSourceOf(m)])) as Record<EvaluationMode, string>,
    ahsNeuronal: { weights: 'fullModeWeights', dimensions: [...inModeDimensions('neuronal-only')], renormalised: true },
    neuralAggregation: {
      primary: 'registered',
      registeredRule: String(FROZEN_VALUES.aggregation.rule),
      variants: {
        proportional: {
          rule: PROPORTIONAL_RULE_ID, strata: 'layer', unitWeight: 'N_h / V_h', failedUnitScore: 'u3-confidence-weight',
          splitVoteScore: 0, invalidUnits: 'excluded-stratum-reweighted',
        },
      },
    },
  };
}

export const METRIC_KEY_TEMPLATES: readonly string[] = ['abstraction-ratio', 'dependency-inversion', 'domain-stability'];
const ROW_FILTER = /WHERE\s+[A-Za-z_][A-Za-z0-9_.]*\s*[<>]=?\s*\$threshold/;

/**
 * Project-level keys: `abstraction-ratio` returns the `'<project>'` file path, and no metric template keys on its
 * metric value (the evidence columns are not discriminators). Row filters: each metric template returns only the
 * rows on the violating side of `$threshold`.
 */
export function metricKeyReadiness(): MetricKeyReadiness {
  const projectRow = CYPHER_TEMPLATES.get('abstraction-ratio')?.template.includes("'<project>' AS filePath") ?? false;
  const noValueKeys = METRIC_KEY_TEMPLATES.every((n) => {
    const evidence = CYPHER_TEMPLATES.get(n)?.resultMapping.evidenceColumns;
    const disc = TEMPLATE_DISCRIMINATORS[n] ?? [];
    return evidence?.every((c) => !disc.includes(c)) === true;
  });
  const rowFilters = METRIC_KEY_TEMPLATES.every((n) => ROW_FILTER.test(CYPHER_TEMPLATES.get(n)?.template ?? ''));
  return { projectLevelKeys: projectRow && noValueKeys, rowFilters };
}

// ---------------------------------------------------------------------------------------------
// Export

/** U4's frozen judge values (U4 §11 / §5.2, verbatim) with the U4 hash anchor of `canonicalJSON(FROZEN_VALUES)`. */
export function judgeFreeze(): unknown {
  return { frozenSha256: FROZEN_SHA256, values: FROZEN_VALUES };
}

export function exportFrozenInstrument(repoRoot: string, judge: unknown = judgeFreeze()): { ok: true; value: FrozenInstrument } | { ok: false; code: string; detail: string } {
  const self = selfSpecDeviations(repoRoot);
  if (!self.ok) return { ok: false, code: FROZEN_EXPORT_SELF_SPEC, detail: self.detail };
  return {
    ok: true,
    value: {
      patternGrammar: PATTERN_GRAMMAR,
      maxCycleLength: MAX_CYCLE_LENGTH,
      cycleRowCap: CYCLE_ROW_CAP,
      applicability: applicabilityTable(),
      tags: templateTags(),
      selfSpecDeviations: self.value,
      scoringFreeze: scoringFreeze(),
      judgeFreeze: judge,
      metricKeyReadiness: metricKeyReadiness(),
      roleExemptions: { instrumentVersion: INSTRUMENT_VERSION, templates: ROLE_EXEMPTIONS },
    },
  };
}

export const EXPORT_USAGE = [
  'Usage: npx tsx scripts/export-frozen-instrument-cli.ts [--out <file>] [--final]',
  '  --out <file>  write the export to <file> (default: stdout)',
  '  --final       refuse (exit 1) unless every frozen value is present (U4 judge freeze)',
  '  --self-test   run a built-in known-bad case (exits 1)',
].join('\n');

export interface ExportMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

export function main(argv: readonly string[], repoRoot: string, io: ExportMainIo, judge: unknown = judgeFreeze()): number {
  let outFile: string | undefined;
  let final = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1] !== undefined) outFile = argv[++i];
    else if (a === '--final') final = true;
    else if (a === '--self-test') {
      // Known-bad input: a final export without the U4 judge freeze.
      return main(['--final'], repoRoot, { ...io, out: () => undefined }, null);
    } else {
      io.err(`${EXPORT_USAGE}\n`);
      return 2;
    }
  }
  if (final && (judge === null || judge === undefined)) {
    io.err(`${FROZEN_EXPORT_FINAL_REFUSED}: the U4 judge freeze is not available (U4 not merged); a final export needs every frozen value\n`);
    return 1;
  }
  const exported = exportFrozenInstrument(repoRoot, judge);
  if (!exported.ok) {
    io.err(`${exported.code}: ${exported.detail}\n`);
    return 1;
  }
  const text = canonicalize(exported.value);
  if (outFile === undefined) io.out(text);
  else io.writeFile(resolve(repoRoot, outFile), text);
  return 0;
}
