import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import type { ParsedSpec, ADRRule } from '../shared/types/spec.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { SpecInput, SpecParserOptions, SpecParserError } from './types.js';
import { DEFAULT_SPEC_PARSER_OPTIONS } from './types.js';
import { validateSpecSchema, validateBusinessRules } from './spec-validator.js';
import { resolveTemplate } from './template-registry.js';
import { parseLayerA, parseLayerB, parseLayerC } from './layer-parsers.js';
import { detectAndParseADR } from './adr-parsers.js';

// ── Standalone Function ───────────────────────────────────────────────────────

export async function parseSpec(
  input: SpecInput,
  options: SpecParserOptions = {},
): Promise<DomainResult<ParsedSpec>> {
  const opts = { ...DEFAULT_SPEC_PARSER_OPTIONS, ...options };
  const warnings: DomainWarning[] = [];

  // 1. Read and parse YAML
  if (!fs.existsSync(input.specFilePath)) {
    return DomainResult.fail<ParsedSpec>([specError('SPEC_NOT_FOUND', `Spec file not found: ${input.specFilePath}`)]);
  }

  let raw: Record<string, unknown>;
  try {
    const content = fs.readFileSync(input.specFilePath, 'utf-8');
    raw = YAML.parse(content) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return DomainResult.fail<ParsedSpec>([specError('YAML_SYNTAX_ERROR', `YAML parse error: ${msg}`)]);
  }

  // 2. JSON Schema validation
  const schemaResult = validateSpecSchema(raw);
  if (!schemaResult.valid) {
    return DomainResult.fail<ParsedSpec>([
      specError('SCHEMA_VALIDATION_FAILED', `Schema validation failed with ${schemaResult.errors.length} error(s): ${schemaResult.errors.map((e) => e.message).join('; ')}`),
    ]);
  }

  // 3. Template resolution
  const arch = raw['architecture'] as Record<string, unknown>;
  const style = arch['style'] as string | undefined;
  let templateFunctions: import('../shared/types/spec.js').FitnessFunction[] | undefined;

  if (style) {
    const template = resolveTemplate(style);
    if (!template) {
      return DomainResult.fail<ParsedSpec>([specError('UNKNOWN_STYLE', `Unknown architecture style "${style}" — no built-in template found`)]);
    }
    templateFunctions = [...template.functions];
  }

  // 4. Parse layers
  const layerModel = parseLayerA(raw);
  const { functions, warnings: mergeWarnings } = parseLayerB(raw, templateFunctions);
  const { scoringWeights, fullModeWeights, verdictThresholds, confidenceThresholds } = parseLayerC(raw);

  for (const w of mergeWarnings) {
    warnings.push({ code: w.code, message: w.message });
  }

  // 5. Check for zero functions
  if (functions.length === 0) {
    return DomainResult.fail<ParsedSpec>([specError('ZERO_FITNESS_FUNCTIONS', 'No fitness functions after template resolution')]);
  }

  // 6. Detect unknown fields
  const knownKeys = new Set(['spec_version', 'architecture', 'fitness_functions', 'scoring', 'confidence_thresholds']);
  for (const key of Object.keys(raw)) {
    if (!knownKeys.has(key)) {
      warnings.push({ code: 'SPEC_001', message: `Unknown field "${key}" in spec (ignored)` });
    }
  }

  // 7. Parse ADRs if directory provided
  let adrRules: ADRRule[] = [];
  if (input.adrDirPath) {
    const adrResult = await parseADRs(input.adrDirPath, opts);
    if (adrResult.success) {
      adrRules = [...adrResult.data];
      if (adrResult.warnings) {
        warnings.push(...adrResult.warnings);
      }
    } else {
      // ADR parse failure is non-fatal; collect warnings
      for (const err of adrResult.errors) {
        warnings.push({ code: 'ADR_001', message: err.message });
      }
    }
  }

  // 8. Assemble ParsedSpec
  const spec: ParsedSpec = {
    specVersion: raw['spec_version'] as string,
    layerModel,
    fitnessFunctions: functions,
    scoringWeights,
    ...(fullModeWeights ? { fullModeWeights } : {}),
    verdictThresholds,
    confidenceThresholds,
    adrRules,
  };

  // 9. Business rule validation
  const bizResult = validateBusinessRules(spec);
  if (!bizResult.valid) {
    if (opts.strictMode) {
      return DomainResult.fail<ParsedSpec>([
        specError('BUSINESS_RULE_VIOLATION', `Business rule violations: ${bizResult.errors.map((e) => e.message).join('; ')}`),
      ]);
    }
    // Non-strict: collect as warnings
    for (const err of bizResult.errors) {
      warnings.push({ code: 'SPEC_001', message: `[${err.rule}] ${err.message}` });
    }
  }
  for (const w of bizResult.warnings) {
    warnings.push({ code: w.code, message: w.message });
  }

  return DomainResult.ok(spec, warnings.length > 0 ? warnings : undefined);
}

// ── ADR Directory Parser ──────────────────────────────────────────────────────

export async function parseADRs(
  adrDirPath: string,
  options: Required<SpecParserOptions> = DEFAULT_SPEC_PARSER_OPTIONS,
): Promise<DomainResult<ADRRule[]>> {
  if (!fs.existsSync(adrDirPath)) {
    return DomainResult.fail<ADRRule[]>([{ code: 'ADR_DIR_NOT_FOUND', message: `ADR directory not found: ${adrDirPath}` }]);
  }

  const files = fs.readdirSync(adrDirPath)
    .filter((f) => f.endsWith('.md') || f.endsWith('.yaml') || f.endsWith('.yml'))
    .slice(0, options.maxADRFiles);

  const rules: ADRRule[] = [];
  const warnings: DomainWarning[] = [];

  for (const file of files) {
    const filePath = path.join(adrDirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = detectAndParseADR(content, filePath);

    if (!result) {
      warnings.push({ code: 'ADR_002', message: `Could not detect ADR format: ${file}` });
      continue;
    }

    if (result.success) {
      rules.push(result.data);
    } else {
      warnings.push({ code: 'ADR_001', message: `Failed to parse ADR "${file}": ${result.errors[0]?.message}` });
    }
  }

  return DomainResult.ok(rules, warnings.length > 0 ? warnings : undefined);
}

// ── PipelineStage Implementation ──────────────────────────────────────────────

export class SpecParserStage implements PipelineStage<SpecInput, ParsedSpec> {
  readonly name = 'spec-parser';

  async execute(input: SpecInput, context: FirewallContext): Promise<DomainResult<ParsedSpec>> {
    const start = Date.now();
    const result = await parseSpec(input);

    if (result.success) {
      context.setParsedSpec(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'spec-parser',
        event: 'Spec parsed successfully',
        durationMs: Date.now() - start,
        metadata: {
          specVersion: result.data.specVersion,
          functionCount: result.data.fitnessFunctions.length,
          adrCount: result.data.adrRules.length,
          layerCount: result.data.layerModel.layers.length,
          warningCount: result.warnings?.length ?? 0,
        },
      });
    } else {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'spec-parser',
        event: `Spec parsing failed: ${result.errors[0]?.message}`,
        durationMs: Date.now() - start,
      });
    }

    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function specError(code: SpecParserError['code'], message: string): SpecParserError {
  return { code, message, stage: 'spec-parser', critical: true };
}
