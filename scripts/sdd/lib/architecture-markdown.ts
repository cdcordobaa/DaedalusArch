/**
 * Spec-driven development bridge (Docs/v1.3/sdd-demo.md): reads the architecture a spec-driven artifact states in
 * prose-friendly Markdown and turns it into the parameters of the DaedalusArch fitness functions.
 *
 * Both front ends (OpenSpec `design.md`, AI-DLC application design) use the same section convention:
 *
 *   ## Architecture
 *   Style: hexagonal
 *
 *   ### Layers
 *   | Layer | Kind | Directories | Roles |
 *   |---|---|---|---|
 *   | domain | domain | `src/domain/**` | entity, value-object |
 *
 *   ### Components            (optional; each path is added to its layer's directories)
 *   | Component | Layer | Path |
 *
 *   ### Allowed dependencies
 *   - application -> domain
 *   - adapters-inbound -> application, domain
 *
 *   ### Forbidden in domain   (optional; the domain-purity rule's packages)
 *   - `express`
 *
 * Several artifacts may each carry such a section (one per change). They are merged order-independently: layers by
 * name (directories and roles united; a kind that differs is a conflict), allowed dependencies per `from` (targets
 * united), forbidden packages united. Nothing is ever removed by a later artifact; a conflict is reported as an error,
 * never resolved silently. Pure: no I/O here.
 */
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const LAYER_KINDS = ['domain', 'application', 'presentation', 'infrastructure'] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];

export interface ArchLayer {
  readonly name: string;
  readonly kind: LayerKind;
  readonly directories: readonly string[];
  readonly roles: readonly string[];
}

export interface ArchComponent {
  readonly name: string;
  readonly layer: string;
  readonly path: string;
}

export interface ArchitectureSection {
  /** The artifact the section was read from (as given by the caller, e.g. a repo-relative path). */
  readonly source: string;
  readonly style?: string;
  readonly layers: readonly ArchLayer[];
  readonly components: readonly ArchComponent[];
  readonly allowed: ReadonlyMap<string, readonly string[]>;
  readonly forbiddenInDomain: readonly string[];
}

export interface MergedArchitecture {
  readonly style: string;
  readonly layers: readonly ArchLayer[];
  readonly allowed: ReadonlyMap<string, readonly string[]>;
  readonly forbiddenInDomain: readonly string[];
  readonly sources: readonly string[];
}

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly string[] };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = <T>(errors: readonly string[]): Outcome<T> => ({ ok: false, errors });

interface Heading {
  readonly level: number;
  readonly title: string;
  readonly line: number;
}

function headingOf(line: string, index: number): Heading | undefined {
  const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
  return m === null ? undefined : { level: (m[1] ?? '').length, title: (m[2] ?? '').trim(), line: index };
}

/** Lines of the first `## Architecture` section (any level >= 2), without fenced code; undefined when absent. */
function architectureLines(markdown: string): string[] | undefined {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  const visible = lines.map((l) => {
    if (/^\s*(```|~~~)/.test(l)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : l;
  });
  const start = visible.findIndex((l, i) => {
    const h = headingOf(l, i);
    return h !== undefined && h.level >= 2 && /^architecture\b/i.test(h.title);
  });
  if (start < 0) return undefined;
  const level = headingOf(visible[start] ?? '', start)?.level ?? 2;
  const end = visible.findIndex((l, i) => {
    if (i <= start) return false;
    const h = headingOf(l, i);
    return h !== undefined && h.level <= level;
  });
  return visible.slice(start + 1, end < 0 ? undefined : end);
}

/** Subsections of the architecture section keyed by their lower-cased title. */
function subsections(lines: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let current = '';
  out.set(current, []);
  lines.forEach((l, i) => {
    const h = headingOf(l, i);
    if (h !== undefined) {
      current = h.title.toLowerCase();
      out.set(current, []);
    } else {
      out.get(current)?.push(l);
    }
  });
  return out;
}

function findSub(subs: Map<string, string[]>, pattern: RegExp): string[] | undefined {
  for (const [title, body] of subs) if (pattern.test(title)) return body;
  return undefined;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

/** A Markdown table as records keyed by lower-cased header. */
function table(lines: readonly string[]): Record<string, string>[] {
  const rows = lines.filter((l) => /^\s*\|/.test(l));
  if (rows.length < 2) return [];
  const header = splitRow(rows[0] ?? '').map((h) => h.toLowerCase());
  return rows
    .slice(1)
    .filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r))
    .map((r) => {
      const cells = splitRow(r);
      return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
    });
}

/** `a, b` / `` `a`, `b` `` / `a<br>b` as a clean list. */
function listCell(cell: string): string[] {
  return cell
    .split(/,|<br\s*\/?>|;/i)
    .map((c) => c.trim().replace(/^`|`$/g, '').trim())
    .filter((c) => c !== '' && c !== '-' && c !== '—');
}

function bullets(lines: readonly string[]): string[] {
  return lines.map((l) => /^\s*[-*+]\s+(.*)$/.exec(l)?.[1]?.trim()).filter((b): b is string => b !== undefined && b !== '');
}

function isKind(k: string): k is LayerKind {
  return (LAYER_KINDS as readonly string[]).includes(k);
}

/**
 * The architecture section of one artifact, or `ok(undefined)` when it has none. Errors name the artifact and the
 * offending row, so an author can fix the Markdown.
 */
export function parseArchitectureSection(markdown: string, source: string): Outcome<ArchitectureSection | undefined> {
  const lines = architectureLines(markdown);
  if (lines === undefined) return ok(undefined);
  const subs = subsections(lines);
  const errors: string[] = [];

  const styleLine = [...subs.values()].flat().map((l) => /^\s*\**style\**\s*:\s*\**\s*`?([a-z-]+)`?/i.exec(l)?.[1]).find((s) => s !== undefined);
  const style = styleLine?.toLowerCase();

  const layers: ArchLayer[] = [];
  for (const row of table(findSub(subs, /^layers?\b/) ?? [])) {
    const name = (row.layer ?? row.name ?? '').replace(/`/g, '').trim();
    const kind = (row.kind ?? '').replace(/`/g, '').trim().toLowerCase();
    if (name === '') {
      errors.push(`${source}: a Layers row has no layer name`);
      continue;
    }
    if (!isKind(kind)) {
      errors.push(`${source}: layer "${name}" has kind "${kind}"; use one of ${LAYER_KINDS.join(', ')}`);
      continue;
    }
    layers.push({ name, kind, directories: listCell(row.directories ?? row.paths ?? ''), roles: listCell(row.roles ?? '') });
  }

  const components: ArchComponent[] = [];
  for (const row of table(findSub(subs, /^components?\b/) ?? [])) {
    const name = (row.component ?? row.name ?? '').replace(/`/g, '').trim();
    const layer = (row.layer ?? '').replace(/`/g, '').trim();
    const p = (row.path ?? row.directory ?? '').replace(/`/g, '').trim();
    if (name === '' || layer === '' || p === '') {
      errors.push(`${source}: a Components row needs Component, Layer and Path`);
      continue;
    }
    components.push({ name, layer, path: p });
  }

  const allowed = new Map<string, string[]>();
  for (const b of bullets(findSub(subs, /^allowed[\s-]+dependenc/) ?? [])) {
    const m = /^`?([\w-]+)`?\s*(?:->|→|=>)\s*(.+)$/.exec(b);
    if (m === null) {
      errors.push(`${source}: cannot read the allowed dependency "${b}"; write "from -> to, to"`);
      continue;
    }
    const from = m[1] ?? '';
    const to = listCell((m[2] ?? '').replace(/\(.*\)\s*$/, ''));
    allowed.set(from, [...new Set([...(allowed.get(from) ?? []), ...to])]);
  }

  const forbiddenInDomain = bullets(findSub(subs, /^forbidden\b/) ?? []).flatMap((b) => listCell(b.replace(/\s+[-—:].*$/, '')));

  if (errors.length > 0) return fail(errors);
  return ok({ source, ...(style !== undefined ? { style } : {}), layers, components, allowed, forbiddenInDomain });
}

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)];

/** Order-independent merge of the sections of several artifacts, with every conflict reported. */
export function mergeArchitectures(sections: readonly ArchitectureSection[]): Outcome<MergedArchitecture> {
  const errors: string[] = [];
  if (sections.length === 0) return fail(['no artifact has an "## Architecture" section']);

  const styles = uniq(sections.map((s) => s.style).filter((s): s is string => s !== undefined));
  if (styles.length === 0) errors.push('no artifact states the style ("Style: <style>")');
  if (styles.length > 1) errors.push(`artifacts state different styles: ${styles.join(', ')}`);

  const layers = new Map<string, { kind: LayerKind; directories: string[]; roles: string[]; from: string }>();
  for (const s of sections) {
    for (const l of s.layers) {
      const prev = layers.get(l.name);
      if (prev === undefined) {
        layers.set(l.name, { kind: l.kind, directories: [...l.directories], roles: [...l.roles], from: s.source });
      } else if (prev.kind !== l.kind) {
        errors.push(`layer "${l.name}" is ${prev.kind} in ${prev.from} but ${l.kind} in ${s.source}`);
      } else {
        prev.directories = uniq([...prev.directories, ...l.directories]);
        prev.roles = uniq([...prev.roles, ...l.roles]);
      }
    }
  }
  for (const s of sections) {
    for (const c of s.components) {
      const layer = layers.get(c.layer);
      if (layer === undefined) errors.push(`${s.source}: component "${c.name}" names unknown layer "${c.layer}"`);
      else layer.directories = uniq([...layer.directories, c.path]);
    }
  }
  if (layers.size === 0) errors.push('no artifact declares a layer ("### Layers" table)');
  for (const [name, l] of layers) if (l.directories.length === 0) errors.push(`layer "${name}" has no directories`);

  const allowed = new Map<string, string[]>();
  for (const s of sections) {
    for (const [from, to] of s.allowed) {
      for (const layer of [from, ...to]) {
        if (!layers.has(layer)) errors.push(`${s.source}: allowed dependency "${from} -> ${to.join(', ')}" names unknown layer "${layer}"`);
      }
      allowed.set(from, uniq([...(allowed.get(from) ?? []), ...to]));
    }
  }

  if (styles[0] === 'hexagonal' && allowed.size === 0) errors.push('a hexagonal architecture needs "### Allowed dependencies"');
  if (errors.length > 0) return fail(uniq(errors));
  const sortedAllowed = new Map([...allowed.entries()].map(([k, v]) => [k, [...v].sort()] as const));
  return ok({
    style: styles[0] ?? '',
    layers: [...layers.entries()].map(([name, l]) => ({ name, kind: l.kind, directories: l.directories, roles: l.roles })),
    allowed: sortedAllowed,
    forbiddenInDomain: uniq(sections.flatMap((s) => s.forbiddenInDomain)),
    sources: sections.map((s) => s.source),
  });
}

interface PresetDoc {
  spec_version?: string;
  architecture?: Record<string, unknown>;
  fitness_functions?: Record<string, unknown>[];
  [k: string]: unknown;
}

/**
 * The DaedalusArch spec YAML: the style's canonical preset (its fitness functions, scoring and thresholds unchanged)
 * with `architecture` taken from the artifacts and, when they name any, the domain-purity packages. Layers keep the
 * artifacts' order of first appearance; the composition-root layer of a hexagonal design is whichever layer the
 * artifacts give no incoming edge, exactly as the preset binds it.
 */
export function buildSpecYaml(merged: MergedArchitecture, presetYaml: string, header: readonly string[] = []): Outcome<string> {
  const preset = parseYaml(presetYaml) as PresetDoc;
  const presetStyle = (preset.architecture as { style?: string } | undefined)?.style;
  if (presetStyle !== merged.style) return fail([`preset style is "${String(presetStyle)}" but the artifacts state "${merged.style}"`]);
  const architecture: Record<string, unknown> = {
    style: merged.style,
    layers: merged.layers.map((l) => ({
      name: l.name,
      kind: l.kind,
      directories: [...l.directories],
      ...(l.roles.length > 0 ? { roles: [...l.roles] } : {}),
    })),
  };
  if (merged.allowed.size > 0) {
    architecture.allowed_dependencies = merged.layers
      .filter((l) => merged.allowed.has(l.name))
      .map((l) => ({ from: l.name, to: [...(merged.allowed.get(l.name) ?? [])] }));
  }
  const fitness = (preset.fitness_functions ?? []).map((ff) =>
    ff.name === 'domain-purity' && merged.forbiddenInDomain.length > 0 ? { ...ff, forbidden_imports: [...merged.forbiddenInDomain] } : ff,
  );
  const doc = { ...preset, architecture, fitness_functions: fitness };
  const comment = header.map((h) => `# ${h}`).join('\n');
  return ok(`${comment}${comment === '' ? '' : '\n'}${stringifyYaml(doc, { lineWidth: 0 })}`);
}
