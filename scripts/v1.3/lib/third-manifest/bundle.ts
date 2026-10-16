/**
 * v1.3 third manifest: the input bundle of one case, built from allow-listed inputs only (Docs/v1.3/third-manifest.md
 * §1). Every file read goes through `InputGuard.read`, which refuses (`TM_INPUT_REFUSED`) any path outside the
 * allow-list, any `daedalus-sealed` path, and any project file whose real path leaves the project root.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { stripComments } from '../labelling/excerpt-scrub.js';
import { STYLE_SOURCES_DOC, styleDefinition } from '../labelling/meaningful-prompt.js';
import { renderPrompt, sha256 } from './prompt.js';
import type { BundleSections } from './prompt.js';

export const RULE_TIERS_DOC = 'Docs/v1.3/rule-tiers.md';
export const SEALED_SEGMENT = 'daedalus-sealed';
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

export class InputRefusedError extends Error {
  readonly code = 'TM_INPUT_REFUSED';
}

export type InputKind = 'A1' | 'A2' | 'A3' | 'A4';

export interface InputRecord {
  readonly input: InputKind;
  /** Repository-relative for A1–A3 inside the repository; project-relative for A4. */
  readonly path: string;
  readonly sha256: string;
}

function hasSealedSegment(p: string): boolean {
  return p.split(/[\\/]/).some((seg) => seg.includes(SEALED_SEGMENT));
}

function within(root: string, p: string): boolean {
  return p === root || p.startsWith(root + path.sep);
}

/**
 * The only reader of the bundle builder. A1 and A2 are two fixed repository files; A3 is one named spec file; A4 is
 * any `.ts` file under one named project root. Real paths are checked, so a symlink cannot widen the list.
 */
export class InputGuard {
  readonly records: InputRecord[] = [];
  private readonly repoRoot: string;
  private readonly specPath: string;
  private readonly projectRoot: string;

  constructor(repoRoot: string, specPath: string, projectRoot: string) {
    for (const p of [repoRoot, specPath, projectRoot]) {
      if (hasSealedSegment(p) || hasSealedSegment(realOrSelf(p))) throw new InputRefusedError(`refused: ${p} lies under ${SEALED_SEGMENT}`);
    }
    this.repoRoot = fs.realpathSync(repoRoot);
    if (!fs.existsSync(specPath) || !fs.statSync(specPath).isFile()) throw new InputRefusedError(`refused: spec ${specPath} is not a file`);
    if (!/\.ya?ml$/.test(specPath)) throw new InputRefusedError(`refused: spec ${specPath} is not a YAML file`);
    this.specPath = fs.realpathSync(specPath);
    if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) throw new InputRefusedError(`refused: project ${projectRoot} is not a directory`);
    this.projectRoot = fs.realpathSync(projectRoot);
    if (within(this.projectRoot, this.repoRoot)) throw new InputRefusedError('refused: the project root contains the repository');
  }

  /** Reads one allow-listed file. Anything else throws before a byte is read. */
  read(kind: InputKind, p: string): string {
    if (hasSealedSegment(p)) throw new InputRefusedError(`refused: ${p} lies under ${SEALED_SEGMENT}`);
    const abs = path.resolve(kind === 'A4' ? this.projectRoot : this.repoRoot, p);
    if (!fs.existsSync(abs)) throw new InputRefusedError(`refused: ${p} does not exist`);
    const real = fs.realpathSync(abs);
    if (hasSealedSegment(real)) throw new InputRefusedError(`refused: ${p} resolves under ${SEALED_SEGMENT}`);
    let rel: string;
    switch (kind) {
      case 'A1':
      case 'A2': {
        const want = path.join(this.repoRoot, kind === 'A1' ? STYLE_SOURCES_DOC : RULE_TIERS_DOC);
        if (real !== want) throw new InputRefusedError(`refused: ${p} is not the ${kind} input`);
        rel = path.relative(this.repoRoot, real).split(path.sep).join('/');
        break;
      }
      case 'A3':
        if (real !== this.specPath) throw new InputRefusedError(`refused: ${p} is not the named spec`);
        rel = within(this.repoRoot, real) ? path.relative(this.repoRoot, real).split(path.sep).join('/') : path.basename(real);
        break;
      case 'A4':
        if (!within(this.projectRoot, real)) throw new InputRefusedError(`refused: ${p} leaves the project root`);
        if (!real.endsWith('.ts')) throw new InputRefusedError(`refused: ${p} is not a .ts source file`);
        if (path.relative(this.projectRoot, real).split(path.sep).some((s) => SKIP_DIRS.has(s))) throw new InputRefusedError(`refused: ${p} is under a skipped directory`);
        rel = path.relative(this.projectRoot, real).split(path.sep).join('/');
        break;
      default:
        throw new InputRefusedError(`refused: unknown input kind ${String(kind)}`);
    }
    const text = fs.readFileSync(real, 'utf8');
    this.records.push({ input: kind, path: rel, sha256: sha256(text) });
    return text;
  }

  /** Project-relative `.ts` paths under the root (names only; symlinked directories are not followed). */
  listSources(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
        if ((e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.ts')) out.push(path.relative(this.projectRoot, path.join(dir, e.name)).split(path.sep).join('/'));
      }
    };
    walk(this.projectRoot);
    return out.sort();
  }
}

function realOrSelf(p: string): string {
  try { return fs.realpathSync(p); } catch { return p; }
}

// ── A2: the tier tables, names and constructs only ──────────────────────────

/**
 * Both tables of rule-tiers.md as one table: rule, template (or the new-rules table's parenthetical note), v1.3 tier, construct reason. The v1.2E severity column
 * and every paragraph outside the tables are cut.
 */
export function tierTable(doc: string): string {
  const rows: string[] = ['| Rule | Template or note | v1.3 tier | Construct reason |', '|---|---|---|---|'];
  let header: string[] | null = null;
  for (const line of doc.split('\n')) {
    if (!line.startsWith('|')) { header = null; continue; }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (header === null) { header = cells.map((c) => c.toLowerCase()); continue; }
    if (cells.every((c) => /^-+$/.test(c))) continue;
    const at = (name: string): string => {
      const i = header?.findIndex((h) => h.startsWith(name)) ?? -1;
      return i >= 0 ? (cells[i] ?? '') : '';
    };
    const rule = at('rule');
    if (header.includes('template')) rows.push(`| ${rule} | ${at('template')} | ${at('v1.3 tier')} | ${at('construct')} |`);
    else {
      // "Rule (template)" column of the new-rules table: the name, with the template in parentheses kept as the template.
      const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(rule);
      rows.push(`| ${m?.[1] ?? rule} | ${m?.[2] ?? ''} | ${at('tier')} | ${at('reason')} |`);
    }
  }
  if (rows.length === 2) throw new Error(`${RULE_TIERS_DOC}: no tier table found`);
  return rows.join('\n');
}

// ── A3: the spec's declarations only ────────────────────────────────────────

const LAYER_KEYS = ['name', 'kind', 'directories', 'roles'] as const;
const DDD_KEYS = ['source_root', 'contexts', 'outside_contexts', 'aggregates', 'value_objects', 'repositories', 'domain_event_types', 'application_services'] as const;

/** `architecture.style`, layers, allowed dependencies and the DDD declarations, re-serialised; the rest is dropped. */
export function declarations(specText: string): { yaml: string; dropped: string[] } {
  const spec = YAML.parse(specText) as Record<string, unknown> | null;
  const arch = (spec?.architecture ?? {}) as Record<string, unknown>;
  const dropped = Object.keys(spec ?? {}).filter((k) => k !== 'architecture').map((k) => k);
  const out: Record<string, unknown> = { style: arch.style };
  const layers = Array.isArray(arch.layers) ? arch.layers as Record<string, unknown>[] : [];
  out.layers = layers.map((l) => {
    const o: Record<string, unknown> = {};
    for (const k of LAYER_KEYS) if (l[k] !== undefined) o[k] = l[k];
    for (const k of Object.keys(l)) if (!(LAYER_KEYS as readonly string[]).includes(k)) dropped.push(`architecture.layers[].${k}`);
    return o;
  });
  if (arch.allowed_dependencies !== undefined) out.allowed_dependencies = arch.allowed_dependencies;
  if (arch.ddd !== undefined && arch.ddd !== null) {
    const d = arch.ddd as Record<string, unknown>;
    const o: Record<string, unknown> = {};
    for (const k of DDD_KEYS) if (d[k] !== undefined) o[k] = d[k];
    for (const k of Object.keys(d)) if (!(DDD_KEYS as readonly string[]).includes(k)) dropped.push(`architecture.ddd.${k}`);
    out.ddd = o;
  }
  for (const k of Object.keys(arch)) if (!['style', 'layers', 'allowed_dependencies', 'ddd'].includes(k)) dropped.push(`architecture.${k}`);
  return { yaml: YAML.stringify({ architecture: out }), dropped: [...new Set(dropped)].sort() };
}

// ── The bundle ──────────────────────────────────────────────────────────────

export interface CaseInput {
  readonly caseId: string;
  readonly style: string;
  readonly specPath: string;
  readonly projectRoot: string;
}

export interface Bundle {
  readonly caseId: string;
  readonly style: string;
  readonly sections: BundleSections;
  readonly prompt: string;
  readonly promptSha256: string;
  /** sha256 of the canonical input records (paths and content hashes, in read order). */
  readonly bundleSha256: string;
  readonly inputs: readonly InputRecord[];
  readonly droppedSpecKeys: readonly string[];
}

export function buildBundle(repoRoot: string, c: CaseInput): Bundle {
  if (!/^case-\d{2,}$/.test(c.caseId)) throw new InputRefusedError(`refused: case id ${c.caseId} is not opaque (case-NN)`);
  const guard = new InputGuard(repoRoot, c.specPath, c.projectRoot);
  const styleRules = styleDefinition(guard.read('A1', STYLE_SOURCES_DOC), c.style);
  const tiers = tierTable(guard.read('A2', RULE_TIERS_DOC));
  const decl = declarations(guard.read('A3', c.specPath));
  const files = guard.listSources().map((p) => ({ path: p, content: stripComments(guard.read('A4', p)) }));
  if (files.length === 0) throw new InputRefusedError(`refused: ${c.projectRoot} has no .ts source file`);
  const sections: BundleSections = { caseId: c.caseId, style: c.style, styleRules, tierTable: tiers, declarations: decl.yaml, files };
  const prompt = renderPrompt(sections);
  const inputs = [...guard.records];
  return {
    caseId: c.caseId, style: c.style, sections, prompt, promptSha256: sha256(prompt),
    bundleSha256: sha256(JSON.stringify(inputs.map((r) => [r.input, r.path, r.sha256]))), inputs, droppedSpecKeys: decl.dropped,
  };
}
