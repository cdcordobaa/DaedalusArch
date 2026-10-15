/**
 * ISE Option 2, step 3: emit the inferred spec. The chosen canonical preset is kept as it is (its fitness functions,
 * thresholds, scoring, allowed dependencies) and only parameterised: each layer's `directories` (and
 * `file_patterns`, where the preset has them) become the inferred ones, and for DDD the `architecture.ddd` block is
 * replaced by the inferred one. The header comment records how the spec was produced.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { parseSpec, validateSpecAgainstProject } from '../spec-parser/index.js';
import type { InferredDdd } from './ddd-inferrer.js';
import type { LayerMapping } from './layer-mapper.js';
import type { IsePreset } from './preset.js';

export interface EmitInput {
  readonly preset: IsePreset;
  readonly mapping: LayerMapping;
  readonly ddd?: InferredDdd;
  /** One line per header comment line (classification, confidence). */
  readonly header: readonly string[];
}

export function emitSpecYaml(input: EmitInput): string {
  const doc = YAML.parseDocument(input.preset.text);
  const layers = doc.getIn(['architecture', 'layers']) as YAML.YAMLSeq | undefined;
  if (layers === undefined) throw new Error('ISE emit: preset has no architecture.layers');
  input.preset.layers.forEach((pl, i) => {
    const inferred = input.mapping.layers.find((l) => l.name === pl.name);
    const dirs = inferred?.directories ?? [];
    doc.setIn(['architecture', 'layers', i, 'directories'], doc.createNode([...dirs]));
    if (pl.filePatterns.length > 0) doc.setIn(['architecture', 'layers', i, 'file_patterns'], doc.createNode([...(inferred?.filePatterns ?? [])]));
  });
  if (input.ddd !== undefined) doc.setIn(['architecture', 'ddd'], doc.createNode(input.ddd));
  doc.commentBefore = [' ISE-inferred spec (exploratory prototype, src/ise). Review before use.', ...input.header.map((h) => ` ${h}`)].join('\n');
  return doc.toString({ lineWidth: 0 });
}

export interface SpecCheck {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** The repository's own spec validator: parse (schema + business rules), then the project checks (v1.3 rules). */
export async function validateEmittedSpec(specYaml: string, projectDir: string): Promise<SpecCheck> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-spec-'));
  try {
    const file = path.join(dir, 'inferred.yaml');
    fs.writeFileSync(file, specYaml);
    const parsed = await parseSpec({ specFilePath: file });
    if (!parsed.success) return { valid: false, errors: parsed.errors.map((e) => `${e.code}: ${e.message}`), warnings: [] };
    const report = validateSpecAgainstProject(parsed.data, projectDir, { rules: 'v1.3' });
    return {
      valid: report.errors.length === 0,
      errors: report.errors.map((e) => `${e.code}: ${e.message}`),
      warnings: report.warnings.map((w) => `${w.code}: ${w.message}`),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
