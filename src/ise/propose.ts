/**
 * Zero-config onboarding (`firewall init`, `evaluate --from-inferred`, MCP `propose_spec`): an ISE spec proposal for
 * a project that has no spec. Runs `inferSpec` on a source snapshot of the project (the ISE anti-leakage boundary:
 * only `src/**` and `tsconfig.json` are read), then turns the inference into
 *
 * - a commented YAML spec: every layer glob carries its confidence, how it was inferred and the evidence;
 * - the mappings as data, the files left without a layer, and the ambiguous folders as questions for the user;
 * - the repository's own checks of the proposal: the spec validator and the fitness compiler.
 *
 * The spec body is the ISE emitter's (`emitSpecYaml`); this module only adds comments, so the evaluated rules are
 * exactly the ones ISE infers.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import picomatch from 'picomatch';
import YAML from 'yaml';
import { compileFunctions, compilerInputFromSpec, V13_COMPILE_OPTIONS } from '../fitness-compiler/index.js';
import { parseSpec } from '../spec-parser/index.js';
import { inferSpec } from './infer.js';
import type { IseInference } from './infer.js';
import type { SpecCheck } from './spec-emitter.js';
import { expandGlob } from './layer-mapper.js';
import type { LayerMapping, MappingSource, UnitMapping } from './layer-mapper.js';
import { snapshotSource } from './snapshot.js';
import type { IseStyle } from './style-classifier.js';

/** The label every inferred-spec output carries. */
export const INFERRED_SPEC_LABEL = 'inferred spec, not author-declared';

/** Mappings below this confidence (structure only, or no basis) become questions. */
export const QUESTION_CONFIDENCE = 0.55;
/** A style whose share of the evidence is below this, or whose runner-up is within `STYLE_MARGIN`, is a question. */
export const STYLE_MIN_CONFIDENCE = 0.6;
export const STYLE_MARGIN = 0.2;

export interface ProposedMapping {
  readonly layer: string;
  /** A directory glob or (`kind: 'file-pattern'`) a file-name pattern of the layer. */
  readonly glob: string;
  readonly kind: 'directory' | 'file-pattern';
  /** `preset`: a glob of the style's canonical preset that matches files here; `inferred`: written by ISE for a unit. */
  readonly origin: 'preset' | 'inferred';
  readonly confidence: number;
  readonly source: MappingSource;
  readonly files: number;
  readonly evidence: string;
}

export interface ProposalQuestion {
  readonly id: string;
  /** The folder (unit) or `style` the question is about. */
  readonly subject: string;
  readonly question: string;
  readonly proposed: string | null;
  readonly alternatives: readonly string[];
  readonly reason: string;
}

export interface ProposalCheck {
  /** Spec schema, business rules and the project checks (`validateSpecAgainstProject`, rules v1.3). */
  readonly valid: boolean;
  /** The fitness compiler accepts it (the v1.3 templates); the firewall can run it. */
  readonly compiles: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface SpecProposal {
  readonly label: typeof INFERRED_SPEC_LABEL;
  readonly style: IseStyle;
  readonly styleConfidence: number;
  readonly styleEvidence: readonly string[];
  readonly ranking: readonly { readonly style: IseStyle; readonly confidence: number }[];
  readonly mappings: readonly ProposedMapping[];
  /** Project-relative files no layer glob or file pattern covers. */
  readonly unassignedFiles: readonly string[];
  readonly questions: readonly ProposalQuestion[];
  /** Majority-vote observations (ISE Option 1) that hold in the code; context for the reviewer, not rules. */
  readonly observations: readonly { readonly statement: string; readonly support: number; readonly instances: number }[];
  readonly check: ProposalCheck;
  /** The commented spec YAML. */
  readonly yaml: string;
}

const pct = (x: number): string => x.toFixed(2);

const SOURCE_TEXT: Record<MappingSource, string> = {
  'preset-glob': 'canonical preset glob',
  'file-pattern': 'file-name pattern of the preset',
  'token+structure': 'folder name and import structure agree',
  token: 'folder name only (the import structure disagrees or is silent)',
  structure: 'import structure only (the folder name is not recognised)',
  'public-api': 'public API of a bounded context',
  'feature-folder': 'feature folder: its files are placed by file-name patterns',
  none: 'no basis',
};

function unitEvidence(u: UnitMapping, mapping: LayerMapping, files: number): string {
  const level = mapping.structure.level.get(u.unit);
  const parts = [SOURCE_TEXT[u.source]];
  if (u.tokenLayer !== null) parts.push(`name suggests ${u.tokenLayer}`);
  if (u.structureLayer !== null) parts.push(`structure suggests ${u.structureLayer}${level !== undefined ? ` (dependency level ${String(level)})` : ''}`);
  parts.push(`${String(files)} file${files === 1 ? '' : 's'}`);
  return parts.join('; ');
}

/** Every directory glob and file pattern of the inferred layers, with the units it covers and their confidence. */
export function proposedMappings(inference: IseInference): ProposedMapping[] {
  const { mapping, preset } = inference;
  const files = mapping.files.map((f) => f.file);
  const out: ProposedMapping[] = [];
  for (const layer of mapping.layers) {
    const presetGlobs = preset.layers.find((l) => l.name === layer.name)?.directories ?? [];
    for (const glob of layer.directories) {
      const m = picomatch(glob, { dot: true });
      const hit = files.filter((f) => m(f));
      const units = mapping.units.filter((u) => mapping.structure.units.find((x) => x.id === u.unit)?.files.some((f) => m(f)) === true);
      const fromPreset = mapping.mode === 'preset-first' && presetGlobs.some((p) => expandGlob(p, files).includes(glob));
      const confidence = units.length === 0 ? 0.5 : Math.min(...units.map((u) => u.confidence));
      const weakest = units.reduce<UnitMapping | undefined>((w, u) => (w === undefined || u.confidence < w.confidence ? u : w), undefined);
      out.push({
        layer: layer.name,
        glob,
        kind: 'directory',
        origin: fromPreset ? 'preset' : 'inferred',
        confidence,
        source: weakest?.source ?? 'none',
        files: hit.length,
        evidence: weakest === undefined ? `${String(hit.length)} files` : unitEvidence(weakest, mapping, hit.length),
      });
    }
    for (const pattern of layer.filePatterns) {
      const m = picomatch(pattern, { dot: true });
      const hit = files.filter((f) => m(f) || m(path.posix.basename(f)));
      out.push({ layer: layer.name, glob: pattern, kind: 'file-pattern', origin: 'preset', confidence: 0.7, source: 'file-pattern', files: hit.length, evidence: `file-name pattern of the preset; ${String(hit.length)} files` });
    }
  }
  return out;
}

/** The ambiguous parts of an inference, as questions: the style when it is close, every weak or missing unit layer. */
export function proposalQuestions(inference: IseInference): ProposalQuestion[] {
  const out: ProposalQuestion[] = [];
  const [top, second] = inference.classification.ranked;
  const layerNames = inference.preset.layers.map((l) => l.name);
  if (top !== undefined && (top.confidence < STYLE_MIN_CONFIDENCE || (second !== undefined && top.confidence - second.confidence < STYLE_MARGIN && second.points > 0))) {
    out.push({
      id: 'style',
      subject: 'style',
      question: `Is this project ${top.style}? The evidence is split${second !== undefined ? ` (${top.style} ${pct(top.confidence)}, ${second.style} ${pct(second.confidence)})` : ''}.`,
      proposed: top.style,
      alternatives: inference.classification.ranked.slice(1).filter((r) => r.points > 0).map((r) => r.style),
      reason: `evidence: ${top.evidence.join('; ') || 'none'}`,
    });
  }
  for (const u of inference.mapping.units) {
    const unit = inference.mapping.structure.units.find((x) => x.id === u.unit);
    const n = unit?.files.length ?? 0;
    if (u.source === 'public-api') continue;
    // Entry files (a root file no unit imports) are deliberately outside the layer order.
    const entry = unit?.kind === 'file' && inference.mapping.structure.roots.includes(u.unit);
    const unplaced = (unit?.files ?? []).filter((f) => inference.mapping.files.find((a) => a.file === f)?.layer === null);
    if (unplaced.length > 0 && !entry) {
      out.push({
        id: `unit:${u.unit}`,
        subject: u.unit,
        question: `Which layer does ${u.unit} belong to? ${String(unplaced.length)} of its ${String(n)} file${n === 1 ? '' : 's'} got no layer, so no layer rule checks ${unplaced.length === 1 ? 'it' : 'them'}.`,
        proposed: null,
        alternatives: layerNames,
        reason: unitEvidence(u, inference.mapping, n),
      });
    } else if (u.layer !== null && (u.confidence < QUESTION_CONFIDENCE || (u.tokenLayer !== null && u.structureLayer !== null && u.tokenLayer !== u.structureLayer))) {
      out.push({
        id: `unit:${u.unit}`,
        subject: u.unit,
        question: `Is ${u.unit} the ${u.layer} layer? ${u.source === 'structure' ? 'Only its imports say so' : 'Its name and its imports disagree'} (confidence ${pct(u.confidence)}).`,
        proposed: u.layer,
        alternatives: layerNames.filter((l) => l !== u.layer),
        reason: unitEvidence(u, inference.mapping, n),
      });
    }
  }
  return out;
}

/** The emitted spec with a header and a trailing comment on every layer glob (the body is unchanged). */
export function commentedYaml(inference: IseInference, mappings: readonly ProposedMapping[], questions: readonly ProposalQuestion[], check: ProposalCheck): string {
  const doc = YAML.parseDocument(inference.specYaml);
  inference.mapping.layers.forEach((layer, i) => {
    const node = doc.getIn(['architecture', 'layers', i], true);
    if (!YAML.isMap(node)) return;
    for (const key of ['directories', 'file_patterns'] as const) {
      const seq = node.get(key, true);
      if (!YAML.isSeq(seq)) continue;
      for (const item of seq.items) {
        if (!YAML.isScalar(item)) continue;
        const m = mappings.find((x) => x.layer === layer.name && x.glob === String(item.value));
        if (m !== undefined) item.comment = ` ${m.origin === 'inferred' ? 'INFERRED' : 'preset'}, confidence ${pct(m.confidence)}: ${m.evidence}`;
      }
    }
  });
  const ddd = doc.getIn(['architecture', 'ddd'], true);
  if (ddd !== undefined && ddd !== null && typeof ddd === 'object' && 'commentBefore' in ddd) {
    (ddd as { commentBefore?: string }).commentBefore = ' INFERRED by ISE from the code (bounded contexts, aggregates, repositories); not copied from the preset.';
  }
  const top = inference.classification.ranked[0];
  const runner = inference.classification.ranked[1];
  const header = [
    ` ${INFERRED_SPEC_LABEL.toUpperCase()}: proposed by \`firewall init\` (ISE, src/ise) from the code alone.`,
    ' Review every line marked INFERRED, answer the questions at the end, then rename or commit this file as your spec.',
    ' The code it was inferred from is its own baseline: violations the code already commits consistently become the rule.',
    ` style: ${inference.style} (confidence ${pct(top?.confidence ?? 0)}${runner !== undefined && runner.points > 0 ? `; runner-up ${runner.style} ${pct(runner.confidence)}` : ''})`,
    ` style evidence: ${(top?.evidence ?? []).join('; ') || 'none'}`,
    ' Everything but the layer globs (and the ddd block) is the canonical preset presets/' + inference.style + '.yaml.',
  ];
  if (!check.valid || !check.compiles) header.push(` WARNING: this proposal does not pass the repository checks: ${check.errors.join('; ')}`);
  doc.commentBefore = header.join('\n');
  doc.comment = questions.length === 0
    ? ' Questions: none (every folder was mapped with its name and its structure agreeing, or by the preset).'
    : [' Questions for the author (ambiguous folders):', ...questions.map((q, i) => ` Q${String(i + 1)}. ${q.question} [${q.reason}]`)].join('\n');
  return doc.toString({ lineWidth: 0 });
}

/** The validator's verdict on a spec text (`validateEmittedSpec`) plus the fitness compiler's (v1.3 templates). */
export async function checkProposal(specYaml: string, validation: SpecCheck): Promise<ProposalCheck> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-propose-'));
  try {
    const file = path.join(dir, 'proposal.yaml');
    fs.writeFileSync(file, specYaml);
    const parsed = await parseSpec({ specFilePath: file });
    if (!parsed.success) return { valid: false, compiles: false, errors: validation.errors, warnings: validation.warnings };
    const compiled = compileFunctions(compilerInputFromSpec(parsed.data), { ...V13_COMPILE_OPTIONS, v13Templates: true });
    const compileErrors = compiled.success ? [] : compiled.errors.map((e) => `${e.code}: ${e.message}`);
    return { valid: validation.valid, compiles: compiled.success, errors: [...validation.errors, ...compileErrors], warnings: validation.warnings };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A proposal from an inference and its check (pure besides the YAML rendering). */
export function proposalFromInference(inference: IseInference, check: ProposalCheck): SpecProposal {
  const mappings = proposedMappings(inference);
  const questions = proposalQuestions(inference);
  const top = inference.classification.ranked.find((r) => r.style === inference.style);
  return {
    label: INFERRED_SPEC_LABEL,
    style: inference.style,
    styleConfidence: top?.confidence ?? 0,
    styleEvidence: top?.evidence ?? [],
    ranking: inference.classification.ranked.map((r) => ({ style: r.style, confidence: r.confidence })),
    mappings,
    unassignedFiles: inference.mapping.files.filter((f) => f.layer === null).map((f) => f.file),
    questions,
    observations: inference.majorityVote
      .filter((r) => r.applies && r.kind !== 'closed-world')
      .map((r) => ({ statement: r.statement, support: r.support, instances: r.instances })),
    check,
    yaml: commentedYaml(inference, mappings, questions, check),
  };
}

export interface ProposeOptions {
  /** The tool's canonical presets directory. */
  readonly presetsDir: string;
}

/**
 * Proposes a spec for `projectDir` (it needs `src/` and `tsconfig.json`). Reads only a snapshot of those two; never
 * reads or writes a spec of the project.
 */
export async function proposeSpec(projectDir: string, opts: ProposeOptions): Promise<SpecProposal> {
  const snap = snapshotSource(path.resolve(projectDir));
  try {
    const inference = await inferSpec(snap.dir, { presetsDir: opts.presetsDir });
    const check = await checkProposal(inference.specYaml, inference.check);
    return proposalFromInference(inference, check);
  } finally {
    snap.dispose();
  }
}

/**
 * The tool's own `presets/` directory: the first ancestor of this module (CommonJS), of the entry script
 * (`bin/firewall.ts`, `dist/cli/index.js`, `dist/mcp-server/main.js`) or of the working directory that holds
 * `presets/clean-architecture.yaml`.
 */
export function builtinPresetsDir(): string {
  const starts = [
    typeof __dirname === 'string' ? __dirname : undefined,
    process.argv[1] !== undefined ? path.dirname(path.resolve(process.argv[1])) : undefined,
    process.cwd(),
  ];
  for (const start of starts) {
    if (start === undefined) continue;
    for (let d = start; ; d = path.dirname(d)) {
      const candidate = path.join(d, 'presets');
      if (fs.existsSync(path.join(candidate, 'clean-architecture.yaml'))) return candidate;
      if (path.dirname(d) === d) break;
    }
  }
  throw new Error('cannot find the presets/ directory of the tool');
}

/** `proposeSpec` with the tool's own presets (the CLI and the MCP server). */
export function proposeWithBuiltinPresets(projectDir: string): Promise<SpecProposal> {
  return proposeSpec(projectDir, { presetsDir: builtinPresetsDir() });
}
