/**
 * `infer_spec`: zero-config onboarding. Runs the ISE prototype (`src/ise`) on a snapshot of the project (its `src/`
 * and `tsconfig.json` only, `snapshotSource`, so nothing else of the project is read and nothing is written to it) and
 * returns the proposed spec YAML with the style classification's confidence and evidence, the per-unit layer mapping
 * and the spec validator's verdict. The answer is a PROPOSAL: an agent or a human must review and confirm it before
 * it is saved and used as the firewall spec.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { inferSpec, ISE_STYLES, snapshotSource } from '../ise/index.js';
import type { IseStyle, MappingMode } from '../ise/index.js';
import type { InferSpecResult } from './types.js';

export interface InferSpecInput {
  readonly projectPath: string;
  readonly presetsDir: string;
  readonly style?: IseStyle | undefined;
  readonly mode?: MappingMode | undefined;
}

/** Majority-vote candidates listed (the strongest first). */
export const MAX_RULE_CANDIDATES = 20;

export function isIseStyle(s: string): s is IseStyle {
  return (ISE_STYLES as readonly string[]).includes(s);
}

export async function inferProjectSpec(input: InferSpecInput): Promise<{ ok: true; data: InferSpecResult } | { ok: false; message: string }> {
  const projectPath = path.resolve(input.projectPath);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) return { ok: false, message: `Project path is not a directory: ${projectPath}` };
  if (!fs.existsSync(path.join(projectPath, 'src'))) return { ok: false, message: `infer_spec needs <project>/src: ${projectPath} has no src/` };
  if (!fs.existsSync(path.join(projectPath, 'tsconfig.json'))) return { ok: false, message: `infer_spec needs <project>/tsconfig.json: ${projectPath} has none` };
  if (!fs.existsSync(input.presetsDir)) return { ok: false, message: `Presets directory not found: ${input.presetsDir} (set DAEDALUS_PRESETS)` };
  const started = Date.now();
  const snap = snapshotSource(projectPath);
  try {
    const inf = await inferSpec(snap.dir, {
      presetsDir: input.presetsDir,
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.style !== undefined ? { style: input.style } : {}),
    });
    const chosen = inf.classification.ranked.find((r) => r.style === inf.style);
    const top = inf.classification.ranked[0];
    const second = inf.classification.ranked[1];
    const lowConfidence = (chosen?.confidence ?? 0) < 0.5 || (top !== undefined && second !== undefined && top.confidence - second.confidence < 0.1);
    const units = inf.mapping.units;
    const unmapped = units.filter((u) => u.layer === null).map((u) => u.unit);
    const review: string[] = [
      'This spec is a proposal: review the style, every layer glob and (for ddd) the contexts and aggregates, then save it and point the server at it (--spec).',
    ];
    if (input.style !== undefined) review.push(`style forced to ${input.style}; classification not used`);
    if (lowConfidence) review.push(`low confidence: ${inf.classification.ranked.slice(0, 3).map((r) => `${r.style} ${r.confidence.toFixed(2)}`).join(', ')}; check the style before anything else`);
    if (unmapped.length > 0) review.push(`units with no layer: ${unmapped.join(', ')}`);
    if (!inf.check.valid) review.push(`the spec validator rejects the proposal: ${inf.check.errors.join('; ')}`);
    return {
      ok: true,
      data: {
        projectPath,
        status: 'proposed',
        style: inf.style,
        styleSource: input.style !== undefined ? 'forced' : 'classified',
        confidence: chosen?.confidence ?? 0,
        lowConfidence,
        ranked: inf.classification.ranked.map((r) => ({ style: r.style, confidence: r.confidence, points: r.points, evidence: [...r.evidence] })),
        mappingMode: inf.mapping.mode,
        layers: inf.mapping.layers.map((l) => ({ name: l.name, directories: [...l.directories], filePatterns: [...l.filePatterns] })),
        units: units.map((u) => ({ unit: u.unit, layer: u.layer, source: u.source, confidence: u.confidence })),
        ...(inf.ddd !== undefined ? { ddd: inf.ddd as unknown as Readonly<Record<string, unknown>> } : {}),
        specYaml: inf.specYaml,
        validation: { valid: inf.check.valid, errors: [...inf.check.errors], warnings: [...inf.check.warnings] },
        ruleCandidates: inf.majorityVote
          .filter((r) => r.applies)
          .slice(0, MAX_RULE_CANDIDATES)
          .map((r) => ({ id: r.id, statement: r.statement, support: r.support, instances: r.instances, mapsTo: [...r.mapsTo] })),
        review,
        durationMs: Date.now() - started,
      },
    };
  } catch (e) {
    return { ok: false, message: `infer_spec failed: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    snap.dispose();
  }
}
