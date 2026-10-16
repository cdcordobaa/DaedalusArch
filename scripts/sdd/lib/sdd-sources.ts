/**
 * Where the spec-driven frameworks keep the architecture, and the one function both converters share.
 *
 * - OpenSpec (Fission-AI/OpenSpec, pinned 1.14.0; `openspec/` layout of the `spec-driven` schema): each change folder
 *   `openspec/changes/<change>/` may hold a `design.md`; archived changes live under `openspec/changes/archive/`. The
 *   architecture is read from every archived change's design plus the active changes named (or all active ones).
 * - AWS AI-DLC (`.aidlc-rule-details/inception/application-design.md`): the Application Design stage writes
 *   `aidlc-docs/inception/application-design/{application-design,components,component-dependency}.md`.
 *
 * Files are read in a fixed, sorted order; the merge is order-independent anyway (architecture-markdown.ts).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSpecYaml, mergeArchitectures, parseArchitectureSection } from './architecture-markdown.js';
import type { ArchitectureSection, MergedArchitecture, Outcome } from './architecture-markdown.js';

export const OPENSPEC_VERSION = '1.14.0';

export interface SourceFile {
  /** Path relative to the project root, POSIX. */
  readonly rel: string;
  readonly text: string;
}

const posix = (p: string): string => p.split(path.sep).join('/');

function readIfFile(root: string, rel: string): SourceFile | undefined {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? { rel: posix(rel), text: fs.readFileSync(abs, 'utf8') } : undefined;
}

function dirs(abs: string): string[] {
  return fs.existsSync(abs) ? fs.readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
}

/**
 * The design files of an OpenSpec project: every archived change, then the active changes (`changes` restricts them;
 * an unknown name is an error so a typo cannot silently drop a design).
 */
export function openSpecDesignFiles(projectRoot: string, changes?: readonly string[]): Outcome<SourceFile[]> {
  const changesDir = path.join(projectRoot, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) return { ok: false, errors: [`no openspec/changes/ under ${projectRoot}`] };
  const archived = dirs(path.join(changesDir, 'archive')).map((d) => path.join('openspec', 'changes', 'archive', d, 'design.md'));
  const active = dirs(changesDir).filter((d) => d !== 'archive');
  const unknown = (changes ?? []).filter((c) => !active.includes(c));
  if (unknown.length > 0) return { ok: false, errors: unknown.map((c) => `no active change "${c}" under openspec/changes/`) };
  const chosen = changes === undefined ? active : active.filter((d) => changes.includes(d));
  const files = [...archived, ...chosen.map((d) => path.join('openspec', 'changes', d, 'design.md'))]
    .map((rel) => readIfFile(projectRoot, rel))
    .filter((f): f is SourceFile => f !== undefined);
  return { ok: true, value: files };
}

export const AIDLC_DESIGN_FILES = Object.freeze([
  'aidlc-docs/inception/application-design/application-design.md',
  'aidlc-docs/inception/application-design/components.md',
  'aidlc-docs/inception/application-design/component-dependency.md',
]);

/** The AI-DLC application-design artifacts that exist, plus any per-unit functional designs' architecture sections. */
export function aidlcDesignFiles(projectRoot: string): Outcome<SourceFile[]> {
  const files = AIDLC_DESIGN_FILES.map((rel) => readIfFile(projectRoot, rel)).filter((f): f is SourceFile => f !== undefined);
  const construction = path.join(projectRoot, 'aidlc-docs', 'construction');
  for (const unit of dirs(construction)) {
    if (unit === 'plans' || unit === 'build-and-test') continue;
    const fd = path.join('aidlc-docs', 'construction', unit, 'functional-design');
    const abs = path.join(projectRoot, fd);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((n) => n.endsWith('.md')).sort()) {
      const file = readIfFile(projectRoot, path.join(fd, f));
      if (file !== undefined) files.push(file);
    }
  }
  if (files.length === 0) return { ok: false, errors: [`no AI-DLC application design under ${projectRoot}/aidlc-docs/inception/application-design/`] };
  return { ok: true, value: files };
}

export interface ConversionResult {
  readonly yaml: string;
  readonly merged: MergedArchitecture;
  /** The artifacts that carried an architecture section, with their sha256. */
  readonly inputs: readonly { readonly rel: string; readonly sha256: string }[];
}

const sha256 = (t: string): string => createHash('sha256').update(t).digest('hex');

/**
 * Artifacts to spec YAML. `presetsDir` holds the canonical presets (`presets/<style>.yaml`). The YAML header names the
 * generator and every input with its hash; nothing time-dependent is written, so the output is reproducible.
 */
export function convert(files: readonly SourceFile[], presetsDir: string, generator: string): Outcome<ConversionResult> {
  const sections: ArchitectureSection[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const parsed = parseArchitectureSection(f.text, f.rel);
    if (!parsed.ok) errors.push(...parsed.errors);
    else if (parsed.value !== undefined) sections.push(parsed.value);
  }
  if (errors.length > 0) return { ok: false, errors };
  const merged = mergeArchitectures(sections);
  if (!merged.ok) return merged;
  const presetPath = path.join(presetsDir, `${merged.value.style}.yaml`);
  if (!fs.existsSync(presetPath)) return { ok: false, errors: [`no preset for style "${merged.value.style}" in ${presetsDir}`] };
  const inputs = sections.map((s) => {
    const text = files.find((f) => f.rel === s.source)?.text ?? '';
    return { rel: s.source, sha256: sha256(text) };
  });
  const header = [
    `Generated by ${generator} (Docs/v1.3/sdd-demo.md). Do not edit: change the design artifacts and regenerate.`,
    `Base: presets/${merged.value.style}.yaml (fitness functions, scoring and thresholds unchanged).`,
    'Architecture from:',
    ...inputs.map((i) => `  ${i.rel} sha256:${i.sha256.slice(0, 16)}`),
  ];
  const yaml = buildSpecYaml(merged.value, fs.readFileSync(presetPath, 'utf8'), header);
  if (!yaml.ok) return yaml;
  return { ok: true, value: { yaml: yaml.value, merged: merged.value, inputs } };
}
