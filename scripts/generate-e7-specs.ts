/**
 * Generates the dev-nest and E7 corpus specs from the registered rule `Docs/e7-spec-rule.md` (ADR-019 items 1, 3;
 * ADR-015 item 1; ADR-012; OI-12; Build and Test Step 55). The rule's machine block is the only input besides each
 * clone's git tree at its registered `commitSha` and the presets. Hand edits of the output are not allowed; a rerun
 * must be byte-identical (`--check`).
 *
 * Per project: C2 file set (`git ls-tree`), segments and suffixes, style (rule §3), the preset with the mapped
 * layer globs appended (§4), then the registered chain (`migrate fr22`, `migrate cv02`, ADR-017 item 4 remap,
 * FR-22 U4 rubric), a header comment with the evidence, and the validity check (§5: compiles; at least
 * `minMappedLayers` layers receive a file). An invalid project is reported as excluded and gets no spec file.
 *
 * Usage: npx tsx scripts/generate-e7-specs-cli.ts --clones <dir> [--out <dir>] [--report <file>] [--check]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, resolve } from 'node:path';
import { isMap, isSeq, parse as parseYaml, parseDocument } from 'yaml';
import type { YAMLMap, YAMLSeq } from 'yaml';
import { applyRubric } from './corpus-rubric-u4.js';
import { CORPUS_FILE, loadCorpus } from './lib/corpus.js';
import type { CorpusEntry } from './lib/corpus.js';
import { loadCompiledSpec } from './lib/mutation/expected.js';
import { layerOf } from './lib/mutation/import-graph.js';
import { migrate } from './migrate-corpus-spec.js';
import { remap } from './remap-domain-layer.js';

export const RULE_DOC = 'Docs/e7-spec-rule.md';
type Group = 'D' | 'A' | 'I' | 'P';
type Style = 'clean-architecture' | 'nestjs' | 'layered';
const GROUPS: readonly Group[] = ['D', 'A', 'I', 'P'];

export interface E7Rule {
  readonly version: number;
  readonly groups: Readonly<Record<Group, { readonly segments: readonly string[]; readonly suffixes: readonly string[] }>>;
  readonly cleanMarkers: Readonly<Partial<Record<Group, readonly string[]>>>;
  readonly cleanMinGroups: number;
  readonly framework: string;
  readonly layers: Readonly<Record<Style, Readonly<Record<string, readonly Group[]>>>>;
  readonly minMappedLayers: number;
  readonly projects: readonly string[];
}

const BLOCK = /^```yaml e7-spec-rule[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

/** Reads the single machine block of the rule document; throws on a missing or duplicated block or a word in two groups. */
export function parseRule(doc: string): E7Rule {
  const blocks = [...doc.matchAll(BLOCK)];
  if (blocks.length !== 1) throw new Error(`${RULE_DOC}: expected one \`\`\`yaml e7-spec-rule block, found ${String(blocks.length)}`);
  const rule = parseYaml(blocks[0]?.[1] ?? '') as E7Rule;
  for (const kind of ['segments', 'suffixes'] as const) {
    const seen = new Map<string, Group>();
    for (const g of GROUPS) {
      for (const w of rule.groups[g][kind]) {
        const prev = seen.get(w);
        if (prev !== undefined) throw new Error(`${RULE_DOC}: ${kind} word ${w} in groups ${prev} and ${g}`);
        seen.set(w, g);
      }
    }
  }
  return rule;
}

/** C2 file set: `src/**.ts` without `*.spec.ts`, `*.test.ts`, `*.d.ts`, at `commitSha` (sorted). */
export function c2Files(cloneDir: string, commitSha: string): string[] {
  const out = execFileSync('git', ['-C', cloneDir, 'ls-tree', '-r', '--name-only', commitSha, 'src'], { encoding: 'utf8' });
  return out.split('\n').filter((p) => p.endsWith('.ts') && !/\.(spec|test|d)\.ts$/.test(p)).sort();
}

export interface Evidence {
  readonly segments: Readonly<Record<Group, readonly string[]>>;
  readonly suffixes: Readonly<Record<Group, readonly string[]>>;
}

/** Found vocabulary words per group (rule §1, §2), sorted. */
export function evidenceOf(files: readonly string[], rule: E7Rule): Evidence {
  const segs = new Set<string>();
  const sufs = new Set<string>();
  for (const f of files) {
    const parts = f.split('/').slice(1);
    const name = parts.pop() ?? '';
    for (const d of parts) segs.add(d.toLowerCase());
    const m = /^.+\.([^.]+)\.ts$/.exec(name);
    if (m?.[1] !== undefined) sufs.add(m[1].toLowerCase());
  }
  const pick = (words: readonly string[], found: Set<string>): string[] => words.filter((w) => found.has(w)).sort();
  const segments = {} as Record<Group, string[]>;
  const suffixes = {} as Record<Group, string[]>;
  for (const g of GROUPS) {
    segments[g] = pick(rule.groups[g].segments, segs);
    suffixes[g] = pick(rule.groups[g].suffixes, sufs);
  }
  return { segments, suffixes };
}

/** Rule §3: the first matching row and its number. */
export function styleOf(ev: Evidence, hasFramework: boolean, rule: E7Rule): { style: Style; row: 1 | 2 | 3; detail: string } {
  const groupsWithMarker = GROUPS.filter((g) => (rule.cleanMarkers[g] ?? []).some((w) => ev.segments[g].includes(w)));
  if (groupsWithMarker.length >= rule.cleanMinGroups) return { style: 'clean-architecture', row: 1, detail: `clean markers in groups ${groupsWithMarker.join(', ')}` };
  if (hasFramework) return { style: 'nestjs', row: 2, detail: `${rule.framework} in dependencies; clean markers in ${groupsWithMarker.length === 0 ? 'no group' : groupsWithMarker.join(', ')}` };
  return { style: 'layered', row: 3, detail: `no ${rule.framework}; clean markers in ${groupsWithMarker.length === 0 ? 'no group' : groupsWithMarker.join(', ')}` };
}

function appendUnique(seq: YAMLSeq, values: readonly string[]): void {
  const have = new Set(seq.items.map((i) => String((i as { value?: unknown }).value ?? i)));
  for (const v of values) if (!have.has(v)) seq.add(v);
}

/** Rule §4: the preset text with the mapped globs appended to each layer (pure). */
export function mapLayers(presetText: string, style: Style, ev: Evidence, rule: E7Rule): string {
  const doc = parseDocument(presetText);
  const layers = doc.getIn(['architecture', 'layers']);
  if (!isSeq(layers)) throw new Error('preset has no architecture.layers');
  const mapping = rule.layers[style];
  for (const node of layers.items) {
    if (!isMap(node)) continue;
    const layer: YAMLMap = node;
    const groups = mapping[String(layer.get('name'))] ?? [];
    const dirs = groups.flatMap((g) => ev.segments[g].map((s) => `**/${s}/**`)).sort();
    const pats = groups.flatMap((g) => ev.suffixes[g].map((x) => `**/*.${x}.ts`)).sort();
    if (dirs.length > 0) {
      const seq = layer.get('directories', true);
      if (!isSeq(seq)) throw new Error(`layer ${String(layer.get('name'))} has no directories list`);
      appendUnique(seq, dirs);
    }
    if (pats.length > 0) {
      let seq = layer.get('file_patterns', true);
      if (seq === undefined) {
        layer.set('file_patterns', doc.createNode([]));
        seq = layer.get('file_patterns', true);
      }
      if (!isSeq(seq)) throw new Error(`layer ${String(layer.get('name'))} file_patterns is not a list`);
      appendUnique(seq, pats);
    }
  }
  return doc.toString({ lineWidth: 0 });
}

/** The registered corpus-spec chain (BR-U5b-77, BR-U4-RUB-03), in order. */
export function applyChain(text: string): string {
  let t = migrate(text, 'fr22').text;
  t = migrate(t, 'cv02').text;
  t = remap(t).text;
  return applyRubric(t).text;
}

export interface ProjectResult {
  readonly projectId: string;
  readonly commitSha: string;
  readonly files: number;
  readonly style: Style;
  readonly styleRow: number;
  readonly styleDetail: string;
  readonly registeredStyle: string | undefined;
  readonly evidence: Evidence;
  readonly layerFiles: Readonly<Record<string, number>>;
  readonly unmapped: number;
  readonly valid: boolean;
  readonly reason?: string;
  readonly specPath: string;
  readonly specSha256?: string;
}

function header(r: Omit<ProjectResult, 'valid' | 'specSha256'>, ruleVersion: number): string {
  const lines = [
    `Generated by scripts/generate-e7-specs.ts from Docs/e7-spec-rule.md v${String(ruleVersion)} (ADR-019 items 1, 3). Do not edit by hand.`,
    `Project ${r.projectId} at ${r.commitSha}; C2 files ${String(r.files)}.`,
    `Style: ${r.style} (rule row ${String(r.styleRow)}: ${r.styleDetail}); corpus.json style ${r.registeredStyle ?? 'none'}.`,
    ...GROUPS.map((g) => `Group ${g}: segments [${r.evidence.segments[g].join(', ')}], suffixes [${r.evidence.suffixes[g].join(', ')}].`),
    `Files per layer: ${Object.entries(r.layerFiles).map(([k, v]) => `${k} ${String(v)}`).join(', ')}, unmapped ${String(r.unmapped)}.`,
  ];
  return `${lines.map((l) => `# ${l}`).join('\n')}\n`;
}

export interface GenerateOptions {
  readonly repoRoot: string;
  readonly clonesDir: string;
  readonly outDir: string;
}

/** Generates one project's spec text and result (writes nothing). */
export async function generateOne(entry: CorpusEntry, rule: E7Rule, o: GenerateOptions): Promise<{ result: ProjectResult; text?: string }> {
  const clone = resolve(o.clonesDir, entry.name);
  const files = c2Files(clone, entry.commitSha);
  const pkg = JSON.parse(execFileSync('git', ['-C', clone, 'show', `${entry.commitSha}:package.json`], { encoding: 'utf8' })) as { dependencies?: Record<string, string> };
  const ev = evidenceOf(files, rule);
  const st = styleOf(ev, pkg.dependencies?.[rule.framework] !== undefined, rule);
  const preset = readFileSync(join(o.repoRoot, 'presets', `${st.style}.yaml`), 'utf8');
  const body = applyChain(mapLayers(preset, st.style, ev, rule));
  const specPath = posix.join(o.outDir, `${entry.name}.yaml`);
  const base = { projectId: entry.name, commitSha: entry.commitSha, files: files.length, style: st.style, styleRow: st.row, styleDetail: st.detail, registeredStyle: entry.style, evidence: ev, specPath };
  // Compile the body in a scratch location (rule §5 a) and count files per compiled layer (§5 b).
  const tmp = mkdtempSync(join(tmpdir(), 'e7-spec-'));
  try {
    const tmpSpec = join(tmp, `${entry.name}.yaml`);
    writeFileSync(tmpSpec, body);
    const compiled = await loadCompiledSpec(tmp, tmpSpec);
    if (!compiled.success) {
      const reason = `does not compile: ${compiled.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`;
      return { result: { ...base, layerFiles: {}, unmapped: files.length, valid: false, reason } };
    }
    const layerFiles: Record<string, number> = {};
    for (const l of compiled.data.layers) layerFiles[l.name] = 0;
    let unmapped = 0;
    for (const f of files) {
      const l = layerOf(f, compiled.data.layers);
      if (l === null) unmapped++;
      else layerFiles[l] = (layerFiles[l] ?? 0) + 1;
    }
    const mapped = Object.values(layerFiles).filter((n) => n > 0).length;
    const r0 = { ...base, layerFiles, unmapped };
    const text = header(r0, rule.version) + body;
    if (mapped < rule.minMappedLayers) {
      return { result: { ...r0, valid: false, reason: `${String(mapped)} layer(s) receive a file, fewer than ${String(rule.minMappedLayers)}` } };
    }
    const { createHash } = await import('node:crypto');
    return { result: { ...r0, valid: true, specSha256: createHash('sha256').update(text).digest('hex') }, text };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export interface GenIo { readonly out: (t: string) => void; readonly err: (t: string) => void }

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: readonly string[], repoRoot: string, io: GenIo): Promise<number> {
  const clones = arg(argv, '--clones');
  if (clones === undefined) {
    io.err('usage: generate-e7-specs-cli.ts --clones <dir> [--out <dir>] [--report <file>] [--check]\n');
    return 2;
  }
  const rule = parseRule(readFileSync(join(repoRoot, RULE_DOC), 'utf8'));
  const loaded = loadCorpus(join(repoRoot, CORPUS_FILE), repoRoot);
  if (!loaded.ok) {
    io.err(`${loaded.errors.join('\n')}\n`);
    return 2;
  }
  const outDir = arg(argv, '--out') ?? 'corpus/specs';
  const check = argv.includes('--check');
  const results: ProjectResult[] = [];
  let drift = 0;
  for (const id of rule.projects) {
    const entry = loaded.corpus.entries.find((e) => e.name === id);
    if (entry === undefined) {
      io.err(`${id}: not in ${CORPUS_FILE}\n`);
      return 2;
    }
    const { result, text } = await generateOne(entry, rule, { repoRoot, clonesDir: resolve(repoRoot, clones), outDir });
    results.push(result);
    const target = join(repoRoot, result.specPath);
    if (text !== undefined) {
      if (check) {
        if (!existsSync(target) || readFileSync(target, 'utf8') !== text) {
          drift++;
          io.err(`${id}: generated spec differs from ${result.specPath}\n`);
        }
      } else {
        mkdirSync(join(repoRoot, outDir), { recursive: true });
        writeFileSync(target, text);
      }
    } else if (check && existsSync(target)) {
      drift++;
      io.err(`${id}: excluded, but ${result.specPath} exists\n`);
    }
    io.out(`${id}: ${result.style} (row ${String(result.styleRow)}), ${result.valid ? `valid, layers ${JSON.stringify(result.layerFiles)}, unmapped ${String(result.unmapped)}` : `EXCLUDED: ${result.reason ?? ''}`}\n`);
  }
  const report = arg(argv, '--report');
  if (report !== undefined) writeFileSync(report, `${JSON.stringify({ ruleVersion: rule.version, results }, null, 2)}\n`);
  return drift === 0 ? 0 : 1;
}
