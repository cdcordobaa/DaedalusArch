/**
 * Rule mining, entry point: propose the implicit rules of a project that has no spec.
 *
 * 1. A neutral snapshot of the project (`snapshotSource`: `src/` and `tsconfig.json` only), as ISE reads it.
 * 2. ISE (`inferFromGraph`): the style and the layer map (preset-first), with the emitted spec as the base.
 * 3. APG v2 extraction of the snapshot (`V13_APG2_OPTIONS`) with the inferred DDD contexts as `module` components and
 *    one `folder` component per top-level folder: components, entry files and the literal import view.
 * 4. The miner (`miner.ts`) and the emitter (`emit.ts`); the emitted spec is parsed, validated against the snapshot
 *    and compiled with the v1.3 compile options, so it is known to compile to the existing templates.
 * Deterministic and offline: no Neo4j, no LLM.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { componentsFromLayerModel, extractAPG, V13_APG2_OPTIONS } from '../apg-extractor/index.js';
import { folderComponents } from '../apg-extractor/apg2/components.js';
import { compileFunctions, compilerInputFromSpec, V13_COMPILE_OPTIONS } from '../fitness-compiler/index.js';
import { inferFromGraph } from '../ise/infer.js';
import { loadIseGraph } from '../ise/graph-view.js';
import type { IseGraph } from '../ise/graph-view.js';
import { snapshotSource } from '../ise/snapshot.js';
import type { IseStyle } from '../ise/style-classifier.js';
import { parseSpec, validateSpecAgainstProject } from '../spec-parser/index.js';
import type { APGResult } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import { emitMinedSpec } from './emit.js';
import type { EmitOptions } from './emit.js';
import { mineRules } from './miner.js';
import type { MineOptions } from './miner.js';
import type { MiningComponent, MiningInput, MiningResult } from './types.js';

export interface ProposeOptions extends EmitOptions, MineOptions {
  /** The tool's canonical presets (`presets/` of this repository). */
  readonly presetsDir: string;
  /** Skip ISE's classification and use this style. */
  readonly style?: IseStyle;
}

export interface SpecCompileCheck {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  /** Fitness function names the v1.3 compiler turned into queries. */
  readonly compiled: readonly string[];
}

export interface Proposal {
  readonly style: IseStyle;
  readonly styleConfidence: number;
  readonly mining: MiningResult;
  readonly specYaml: string;
  readonly check: SpecCompileCheck;
}

/** Parses a spec text (through a temporary file, as the parser reads files). */
async function parseSpecText(text: string): Promise<Awaited<ReturnType<typeof parseSpec>>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-spec-'));
  try {
    const file = path.join(dir, 'spec.yaml');
    fs.writeFileSync(file, text);
    return await parseSpec({ specFilePath: file });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Validates the emitted spec against the project and compiles it with the v1.3 options. */
export async function checkEmittedSpec(specYaml: string, projectDir: string): Promise<SpecCompileCheck> {
  const parsed = await parseSpecText(specYaml);
  if (!parsed.success) return { valid: false, errors: parsed.errors.map((e) => `${e.code}: ${e.message}`), warnings: [], compiled: [] };
  const report = validateSpecAgainstProject(parsed.data, projectDir, { rules: 'v1.3' });
  const compiled = compileFunctions(compilerInputFromSpec(parsed.data), V13_COMPILE_OPTIONS);
  const errors = [...report.errors.map((e) => `${e.code}: ${e.message}`), ...(compiled.success ? [] : compiled.errors.map((e) => `COMPILE ${e.code}: ${e.message}`))];
  return {
    valid: errors.length === 0,
    errors,
    warnings: report.warnings.map((w) => `${w.code}: ${w.message}`),
    compiled: compiled.success ? [...new Set(compiled.data.symbolicQueries.map((q) => q.name))].sort() : [],
  };
}

const relTo = (root: string) => (p: string): string => {
  const f = p.replace(/\\/g, '/');
  const r = root.replace(/\\/g, '/');
  return (f.startsWith(r + '/') ? f.slice(r.length + 1) : f).replace(/^\.\//, '');
};

/** The APG v2 module / folder components and the literal import view of an extraction. */
export function componentsOf(apg: APGResult, rel: (p: string) => string, layerModel: LayerModel): { components: MiningComponent[]; literalEdges: { from: string; to: string }[] } {
  const fileById = new Map<string, string>();
  const compById = new Map<string, { name: string; kind: string }>();
  for (const n of apg.nodes) {
    if (n.type === 'File') fileById.set(n.id, rel(n.filePath));
    else if (n.type === 'Component') compById.set(n.id, { name: n.name, kind: n.filePath.replace(/^component:/, '') });
  }
  const members = new Map<string, { files: string[]; entries: string[] }>();
  const literalEdges: { from: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const e of apg.edges) {
    if (e.type === 'BELONGS_TO') {
      const f = fileById.get(e.sourceId);
      if (f === undefined || !compById.has(e.targetId)) continue;
      const m = members.get(e.targetId) ?? { files: [], entries: [] };
      m.files.push(f);
      if (e.properties.entry === true) m.entries.push(f);
      members.set(e.targetId, m);
    } else if (e.type === 'IMPORTS' && e.properties.viaReExport !== true) {
      const s = fileById.get(e.sourceId);
      const t = fileById.get(e.targetId);
      if (s === undefined || t === undefined || s === t || seen.has(`${s}|${t}`)) continue;
      seen.add(`${s}|${t}`);
      literalEdges.push({ from: s, to: t });
    }
  }
  const declaredApi = new Set((layerModel.ddd?.contexts ?? []).filter((c) => c.publicApi.length > 0).map((c) => c.name));
  const components: MiningComponent[] = [];
  for (const [id, c] of [...compById].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (c.kind !== 'module' && c.kind !== 'folder') continue;
    const m = members.get(id) ?? { files: [], entries: [] };
    components.push({
      name: c.name, kind: c.kind, files: m.files.sort(), entries: m.entries.sort(),
      publicApiDeclared: c.kind === 'module' && declaredApi.has(c.name),
    });
  }
  return { components, literalEdges: literalEdges.sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1)) };
}

/** The miner's input from the ISE graph, the inferred layer map and the APG v2 extraction. */
export function miningInput(graph: IseGraph, layerOf: ReadonlyMap<string, string | null>, layerModel: LayerModel, apg2?: ReturnType<typeof componentsOf>): MiningInput {
  return {
    files: graph.files,
    layerOf,
    layers: layerModel.layers.map((l) => l.name),
    layerKinds: new Map(layerModel.layers.map((l) => [l.name, l.kind])),
    fileEdges: graph.edges,
    packageImports: graph.packageImports,
    declarations: graph.declarations,
    typeEdges: graph.typeEdges,
    ...(apg2 !== undefined ? { components: apg2.components, literalEdges: apg2.literalEdges } : {}),
  };
}

export interface ProjectAnalysis {
  readonly root: string;
  readonly graph: IseGraph;
  readonly inference: ReturnType<typeof inferFromGraph>;
  readonly layerModel: LayerModel;
  readonly apg2: ReturnType<typeof componentsOf>;
  readonly input: MiningInput;
}

/** ISE, the parsed ISE spec and the APG v2 components of a snapshot directory (`root`, already a snapshot). */
export async function analyseSnapshot(root: string, opts: Pick<ProposeOptions, 'presetsDir' | 'style'>): Promise<ProjectAnalysis> {
  const graph = await loadIseGraph(root);
  const inference = inferFromGraph(graph, { presetsDir: opts.presetsDir, ...(opts.style !== undefined ? { style: opts.style } : {}) });
  const parsed = await parseSpecText(inference.specYaml);
  if (!parsed.success) throw new Error(`rule mining: the ISE spec does not parse: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const layerModel = parsed.data.layerModel;
  const components = [...componentsFromLayerModel(layerModel).filter((c) => c.kind !== 'layer'), ...folderComponents(graph.files)];
  const res = await extractAPG(root, { ...V13_APG2_OPTIONS, components }, path.join(root, 'tsconfig.json'));
  if (!res.success) throw new Error(`rule mining: APG v2 extraction failed: ${res.errors.map((e) => e.message).join('; ')}`);
  const apg2 = componentsOf(res.data, relTo(root), layerModel);
  const layerOf = new Map(inference.mapping.files.map((f) => [f.file, f.layer]));
  return { root, graph, inference, layerModel, apg2, input: miningInput(graph, layerOf, layerModel, apg2) };
}

/** Mines and emits from an analysis; the spec is checked against `analysis.root`. */
export async function proposeFromAnalysis(analysis: ProjectAnalysis, opts: ProposeOptions): Promise<Proposal> {
  const inf = analysis.inference;
  const mining = mineRules(analysis.input, inf.style, opts);
  const top = inf.classification.ranked.find((r) => r.style === inf.style);
  const header = [
    `style: ${inf.style} (${opts.style !== undefined ? 'forced' : `ISE, confidence ${(top?.confidence ?? 0).toFixed(2)}`}); layers: ISE ${inf.mapping.mode}`,
  ];
  const specYaml = emitMinedSpec(inf.specYaml, mining, header, opts);
  const check = await checkEmittedSpec(specYaml, analysis.root);
  return { style: inf.style, styleConfidence: top?.confidence ?? 0, mining, specYaml, check };
}

/** Proposes the implicit rules of the project at `projectDir` (read through a snapshot; never written). */
export async function proposeRules(projectDir: string, opts: ProposeOptions): Promise<Proposal> {
  const snap = snapshotSource(projectDir);
  try {
    return await proposeFromAnalysis(await analyseSnapshot(fs.realpathSync(snap.dir), opts), opts);
  } finally {
    snap.dispose();
  }
}
