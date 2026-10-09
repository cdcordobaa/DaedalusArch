/**
 * Pre-run E1 judge-volume estimate (ADR-021 SO5; SO5-08; BR-U4-OPS-04, SEL-01..04, AGG-01; `Docs/judge-preregistration.md`
 * "compared against the pre-run volume estimate").
 *
 * For each evidence project (the fixture and the pilot trees) the judge units of the two neuronal functions are
 * counted offline, with U4's own unit builders (`buildFileUnits` for FF-N02 `intent-alignment`, `buildModuleUnits` for
 * FF-N01 `architectural-integrity`) over a candidate list that follows BR-U4-SEL-01 on the file tree (the layer of
 * the first spec layer whose directory glob matches; `*.d.ts`, `*.spec.ts`, `*.test.ts`, `node_modules` excluded as
 * by the extractor; barrels by the extractor's `detectBarrel`; test, e2e and generated paths and markers excluded).
 * The judged units per function are `min(unitCap, units)`, so the calls of one full-mode evaluation are
 * `initProbes + runsPerEvaluation × (selected FF-N01 + selected FF-N02)` (the SEN-01 ledger shape: one init probe
 * plus units × 3). The E1 volume is that figure × 54 cells (every cell assumed `ok`, the upper case): central = mean
 * of the pilot projects, low = min, high = max, and the cap ceiling `54 × (1 + 3 × 2 × 20)`. Time is calls × the
 * measured median `duration_ms` (6570 ms at effort `high`, Gate H), sequential and at `maxConcurrency`.
 *
 * Usage (repository root):
 *   npx tsx scripts/e1-judge-volume-cli.ts --spec specs/clean-arch.yaml --project <label>=<dir> [...]
 *       [--cross-check <label>=<fileUnits>,<moduleUnits>] [--date YYYY-MM-DD] [--out <file.md>]
 *   npx tsx scripts/e1-judge-volume-cli.ts --self-test   (known-bad input: must fail)
 * No judge call is made. Exit codes: 0 written, 1 a project cannot be read, 2 usage.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Project } from 'ts-morph';
import { parse as parseYaml } from 'yaml';
import { detectBarrel } from '../src/apg-extractor/node-extractor.js';
import { globToRegex } from '../src/fitness-compiler/glob-to-regex.js';
import { MAX_CONCURRENCY, RUNS_PER_EVALUATION, UNIT_CAP } from '../src/llm-critic/frozen.js';
import { buildFileUnits, buildModuleUnits } from '../src/llm-critic/judge-unit-selector.js';
import type { CandidateFile, CandidateFiles } from '../src/llm-critic/judge-unit-selector.js';
import type { ExclusionReason } from '../src/shared/types/evaluation.js';
import type { LayerDefinition } from '../src/shared/types/spec.js';

/** E1 = 3 models × 3 levels × 2 tasks × 3 runs (ADR-017 item 3). */
export const E1_CELLS = 54;
/** Measured median judge `duration_ms` at effort `high` (Gate H probe, `Docs/judge-preregistration.md`). */
export const MEDIAN_JUDGE_MS = 6570;
/** One init probe per judge-mode evaluation (BR-U4-ISO-06; the SEN-01 ledger counts it). */
export const INIT_PROBES_PER_EVALUATION = 1;
/** Hypothetical calls per usage window: the real figure is unmeasured (build-and-test summary §8). */
export const WINDOW_HYPOTHESES: readonly number[] = Object.freeze([50, 100, 200, 400]);

const EXCLUDED_SUFFIXES = ['.d.ts', '.spec.ts', '.test.ts'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);
const TEST_SEGMENTS = new Set(['__tests__', '__mocks__', 'test', 'tests', 'e2e']);
const GENERATED_MARKERS = ['@generated', 'DO NOT EDIT'];

export interface TreeFile {
  /** Root-relative POSIX path. */
  readonly path: string;
  readonly text: string;
}

/** `.ts` files under `root` the extractor would read (DEFAULT_EXCLUDE_PATTERNS), sorted, symlinks not followed. */
export function readTree(root: string): TreeFile[] {
  const out: TreeFile[] = [];
  const walk = (rel: string): void => {
    for (const e of readdirSync(rel === '' ? root : join(root, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!SKIPPED_DIRS.has(e.name)) walk(r);
      } else if (e.isFile() && r.endsWith('.ts') && !EXCLUDED_SUFFIXES.some((s) => r.endsWith(s))) {
        out.push({ path: r, text: readFileSync(join(root, r), 'utf8') });
      }
    }
  };
  walk('');
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** The layers of an AoC spec (name, directories, file patterns). */
export function specLayers(specText: string): LayerDefinition[] {
  const doc = parseYaml(specText) as { architecture?: { layers?: { name: string; directories?: string[]; filePatterns?: string[]; file_patterns?: string[] }[] } };
  return (doc.architecture?.layers ?? []).map((l) => ({
    name: l.name, directories: l.directories ?? [], naming: [], role: '',
    ...((l.filePatterns ?? l.file_patterns) !== undefined ? { filePatterns: l.filePatterns ?? l.file_patterns } : {}),
  }));
}

function layerOf(path: string, layers: readonly LayerDefinition[]): string | null {
  for (const l of layers) {
    for (const g of [...l.directories, ...(l.filePatterns ?? [])]) if (new RegExp(globToRegex(g)).test(path)) return l.name;
  }
  return null;
}

function isBarrelText(path: string, text: string): boolean {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  return detectBarrel(project.createSourceFile(`/${path}`, text));
}

/** BR-U4-SEL-01 on a file tree (see the module header); `uncoveredFiles` are the unlayered files. */
export function candidatesOf(files: readonly TreeFile[], layers: readonly LayerDefinition[]): CandidateFiles {
  const exclusions: Record<ExclusionReason, number> = {
    unlayered: 0, 'exclude-paths': 0, barrel: 0, 'test-path': 0, 'e2e-spec': 0, 'generated-path': 0, 'generated-marker': 0,
  };
  const uncovered: string[] = [];
  const kept: CandidateFile[] = [];
  for (const f of files) {
    const layer = layerOf(f.path, layers);
    const dirs = f.path.split('/').slice(0, -1);
    let reason: ExclusionReason | null = null;
    if (layer === null) reason = 'unlayered';
    else if (isBarrelText(f.path, f.text)) reason = 'barrel';
    else if (dirs.some((s) => TEST_SEGMENTS.has(s))) reason = 'test-path';
    else if (f.path.endsWith('.e2e-spec.ts')) reason = 'e2e-spec';
    else if (dirs.includes('generated') || dirs.some((s, i) => s === 'prisma' && dirs[i + 1] === 'client')) reason = 'generated-path';
    else if (f.text.split(/\r?\n/, 10).some((line) => GENERATED_MARKERS.some((m) => line.includes(m)))) reason = 'generated-marker';
    if (reason !== null) {
      exclusions[reason]++;
      if (reason === 'unlayered') uncovered.push(f.path);
      continue;
    }
    kept.push({ path: f.path, layer: layer ?? '', sizeChars: f.text.length });
  }
  return { files: kept, exclusions, uncoveredFiles: uncovered };
}

export interface ProjectVolume {
  readonly label: string;
  readonly tsFiles: number;
  readonly candidates: number;
  /** FF-N02 `intent-alignment` file units, before and after the cap. */
  readonly fileUnits: number;
  readonly fileSelected: number;
  /** FF-N01 `architectural-integrity` module units, before and after the cap. */
  readonly moduleUnits: number;
  readonly moduleSelected: number;
  /** `INIT_PROBES_PER_EVALUATION + RUNS_PER_EVALUATION × (fileSelected + moduleSelected)`. */
  readonly calls: number;
}

/** The judge volume of one full-mode evaluation of a project. */
export function projectVolume(label: string, files: readonly TreeFile[], layers: readonly LayerDefinition[], cap = UNIT_CAP, runs = RUNS_PER_EVALUATION): ProjectVolume {
  const c = candidatesOf(files, layers);
  const fileUnits = buildFileUnits(c).length;
  const moduleUnits = buildModuleUnits(c, layers).length;
  const fileSelected = Math.min(cap, fileUnits);
  const moduleSelected = Math.min(cap, moduleUnits);
  return {
    label, tsFiles: files.length, candidates: c.files.length, fileUnits, fileSelected, moduleUnits, moduleSelected,
    calls: INIT_PROBES_PER_EVALUATION + runs * (fileSelected + moduleSelected),
  };
}

export interface E1Estimate {
  readonly low: number;
  readonly central: number;
  readonly high: number;
  /** Every cell capped on both functions. */
  readonly ceiling: number;
}

/** E1 calls from the per-project calls of the generated (pilot) projects; `central` rounded up. */
export function estimateE1(perProjectCalls: readonly number[], cells = E1_CELLS, cap = UNIT_CAP, runs = RUNS_PER_EVALUATION): E1Estimate {
  if (perProjectCalls.length === 0) throw new Error('estimateE1: no evidence project');
  const mean = perProjectCalls.reduce((a, b) => a + b, 0) / perProjectCalls.length;
  return {
    low: cells * Math.min(...perProjectCalls),
    central: Math.ceil(cells * mean),
    high: cells * Math.max(...perProjectCalls),
    ceiling: cells * (INIT_PROBES_PER_EVALUATION + runs * 2 * cap),
  };
}

/** Judge hours for `calls` at `medianMs`, sequential (`concurrency` 1) or at `concurrency`. */
export function judgeHours(calls: number, medianMs = MEDIAN_JUDGE_MS, concurrency = 1): number {
  return (calls * medianMs) / concurrency / 3_600_000;
}

/** Usage windows needed when a window allows `perWindow` calls. */
export function windowsNeeded(calls: number, perWindow: number): number {
  return Math.ceil(calls / perWindow);
}

// ---------------------------------------------------------------------------------------------
// Report

function f1(x: number): string {
  return x.toFixed(1);
}

export interface CrossCheck {
  readonly label: string;
  readonly fileUnits: number;
  readonly moduleUnits: number;
}

export interface ReportInput {
  readonly date: string;
  readonly specPath: string;
  /** Evidence projects; labels starting with `pilot` are the generated projects the E1 figure uses. */
  readonly projects: readonly (ProjectVolume & { readonly source: string })[];
  readonly crossChecks: readonly CrossCheck[];
  /** The command line that wrote the report (reproduction). */
  readonly command?: string;
}

export function renderReport(input: ReportInput): string {
  const pilots = input.projects.filter((p) => p.label.startsWith('pilot'));
  const est = estimateE1(pilots.map((p) => p.calls));
  const lines: string[] = [];
  lines.push('# E1 judge-volume estimate (pre-run)', '');
  lines.push(`> **Status**: pre-run estimate, ${input.date} (ADR-021 SO5-08). Written by \`scripts/e1-judge-volume-cli.ts\` from the file trees below; no judge call was made. This is the "pre-run volume estimate" that \`Docs/judge-preregistration.md\` compares measured calls per usage window against (BR-U4-OPS-04). Not a result.`, '');
  if (input.command !== undefined) lines.push(`Reproduce from the repository root: \`${input.command}\``, '');
  lines.push('## Method', '');
  lines.push(`- Judge units are counted with U4's own builders over a BR-U4-SEL-01 candidate list of each tree (spec \`${input.specPath}\`): FF-N02 \`intent-alignment\` judges file units, FF-N01 \`architectural-integrity\` module units (BR-U4-SEL-02, SEL-03).`);
  lines.push(`- Judged units per function = min(\`unitCap\` ${String(UNIT_CAP)}, units) (SEL-04; the E1 \`unitCap\` never changes, OPS-04).`);
  lines.push(`- Calls per full-mode evaluation = ${String(INIT_PROBES_PER_EVALUATION)} init probe + \`runsPerEvaluation\` ${String(RUNS_PER_EVALUATION)} × (FF-N01 units + FF-N02 units), the shape of the SEN-01 ledger lines. No cassette hit is assumed (every E1 project is new).`);
  lines.push(`- E1 = ${String(E1_CELLS)} cells, all assumed \`ok\` (not-run cells are not judged, so this is the upper case). Central = mean of the pilot projects × ${String(E1_CELLS)} (rounded up); low and high = their min and max × ${String(E1_CELLS)}; ceiling = every cell capped on both functions.`);
  lines.push(`- Time = calls × the measured median \`duration_ms\` ${String(MEDIAN_JUDGE_MS)} ms (${f1(MEDIAN_JUDGE_MS / 1000)} s, effort \`high\`, Gate H), sequential and at \`maxConcurrency\` ${String(MAX_CONCURRENCY)}.`, '');
  lines.push('## Evidence projects', '');
  lines.push('| Project | Source | `.ts` files | Candidates | FF-N02 file units (judged) | FF-N01 module units (judged) | Calls per evaluation |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const p of input.projects) {
    lines.push(`| ${p.label} | \`${p.source}\` | ${String(p.tsFiles)} | ${String(p.candidates)} | ${String(p.fileUnits)} (${String(p.fileSelected)}) | ${String(p.moduleUnits)} (${String(p.moduleSelected)}) | ${String(p.calls)} |`);
  }
  lines.push('');
  if (input.crossChecks.length > 0) {
    lines.push('**Cross-check of the counting against live runs**:', '');
    for (const c of input.crossChecks) {
      const p = input.projects.find((x) => x.label === c.label);
      const ok = p?.fileUnits === c.fileUnits && p.moduleUnits === c.moduleUnits;
      lines.push(`- ${c.label}: recorded ${String(c.fileUnits)} file units and ${String(c.moduleUnits)} module units; counted ${p === undefined ? 'n/a' : `${String(p.fileUnits)} and ${String(p.moduleUnits)}`}: **${ok ? 'equal' : 'different'}**.`);
    }
    lines.push('');
  }
  lines.push('## E1 estimate', '');
  lines.push(`| Case | Judge calls | Sequential judge time (h) | At concurrency ${String(MAX_CONCURRENCY)} (h) |`);
  lines.push('|---|---|---|---|');
  for (const [name, calls] of [['Low (smallest pilot × 54)', est.low], ['Central (pilot mean × 54)', est.central], ['High (largest pilot × 54)', est.high], ['Cap ceiling (54 × (1 + 3 × 2 × 20))', est.ceiling]] as const) {
    lines.push(`| ${name} | ${String(calls)} | ${f1(judgeHours(calls))} | ${f1(judgeHours(calls, MEDIAN_JUDGE_MS, MAX_CONCURRENCY))} |`);
  }
  lines.push('');
  lines.push('## Usage-window risk', '');
  lines.push('Calls per usage window on the subscription are **unmeasured** (build-and-test summary §8; `USAGE_LIMIT` patterns unverified, ADR-018 item 5). Windows needed for the central and ceiling cases under hypothetical window sizes:', '');
  lines.push(`| Calls per window | Central (${String(est.central)} calls) | Ceiling (${String(est.ceiling)} calls) |`);
  lines.push('|---|---|---|');
  for (const w of WINDOW_HYPOTHESES) lines.push(`| ${String(w)} | ${String(windowsNeeded(est.central, w))} | ${String(windowsNeeded(est.ceiling, w))} |`);
  lines.push('');
  lines.push('- The degradation ladder cannot shrink E1: its unit cap, judge model, `runsPerEvaluation` and rubric never change mid-study (BR-U4-OPS-04). Only step 3 (effort `high` → `medium`, with a full re-record) reaches E1, and only at a usage-window boundary before any E1 score is viewed.');
  lines.push('- A usage stop inside an evaluation ends that entry `incomplete` (`usage-limit`, U4 exit 3), which is resumable; it is not a rejection. The E1 run therefore spans several windows whenever the window size is below the figures above, and the number of windows is a schedule risk, not a validity risk.');
  lines.push('- The evidence is narrow: three pilot projects, one model (`claude-opus-5-5`) and one task (`task-management`), plus the fixture. Sonnet, Haiku and `order-fulfilment` trees may differ in size; the cap ceiling bounds every case.');
  lines.push('- Before the E1 run, the measured calls per window (from the pilot or the first E1 window) are compared against this estimate, as `Docs/judge-preregistration.md` requires; that comparison is dated there, not here.');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// CLI

export const VOLUME_USAGE = [
  'Usage: npx tsx scripts/e1-judge-volume-cli.ts --spec <spec.yaml> --project <label>=<dir> [--project ...]',
  '         [--cross-check <label>=<fileUnits>,<moduleUnits>] [--date YYYY-MM-DD] [--out <file.md>]',
  '       npx tsx scripts/e1-judge-volume-cli.ts --self-test',
].join('\n');

export interface VolumeMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

export function main(argv: readonly string[], repoRoot: string, io: VolumeMainIo): number {
  if (argv[0] === '--self-test') {
    // Known-bad input: a project directory that does not exist.
    const code = main(['--spec', 'specs/clean-arch.yaml', '--project', 'pilot-x=does-not-exist'], repoRoot, io);
    return code === 0 ? 0 : 1;
  }
  let spec: string | undefined;
  let outFile: string | undefined;
  let date = new Date().toISOString().slice(0, 10);
  const projects: { label: string; dir: string }[] = [];
  const crossChecks: CrossCheck[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
      io.err(`${VOLUME_USAGE}\n`);
      return 2;
    }
    i++;
    if (a === '--spec') spec = v;
    else if (a === '--out') outFile = v;
    else if (a === '--date') date = v;
    else if (a === '--project' && v.includes('=')) projects.push({ label: v.slice(0, v.indexOf('=')), dir: v.slice(v.indexOf('=') + 1) });
    else if (a === '--cross-check' && /^[^=]+=\d+,\d+$/.test(v)) {
      const [label, nums] = v.split('=') as [string, string];
      const [fu, mu] = nums.split(',').map(Number) as [number, number];
      crossChecks.push({ label, fileUnits: fu, moduleUnits: mu });
    } else {
      io.err(`${VOLUME_USAGE}\n`);
      return 2;
    }
  }
  if (spec === undefined || projects.length === 0 || !projects.some((p) => p.label.startsWith('pilot'))) {
    io.err(`${VOLUME_USAGE}\n(at least one --project label must start with "pilot")\n`);
    return 2;
  }
  const layers = specLayers(readFileSync(resolve(repoRoot, spec), 'utf8'));
  const volumes: (ProjectVolume & { source: string })[] = [];
  for (const p of projects) {
    const dir = resolve(repoRoot, p.dir);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      io.err(`project ${p.label}: ${p.dir} is not a directory\n`);
      return 1;
    }
    volumes.push({ ...projectVolume(p.label, readTree(dir), layers), source: relative(repoRoot, dir).split('\\').join('/') });
  }
  const command = ['npx tsx scripts/e1-judge-volume-cli.ts', ...argv.filter((_, i) => argv[i - 1] !== '--out' && argv[i] !== '--out')].join(' ');
  const text = renderReport({ date, specPath: spec, projects: volumes, crossChecks, command });
  if (outFile !== undefined) io.writeFile(resolve(repoRoot, outFile), text);
  else io.out(text);
  return 0;
}
