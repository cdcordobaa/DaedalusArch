/**
 * ISE robustness, held-out rename probes (2026-10-15). The prototype's rename map (`ise-targets.ts`, P1-P5) is the
 * DEVELOPMENT probe: the structural fixes of `src/ise` were developed against it. The probes here were defined and
 * committed before the fixed code was ever run on them, and are the honest estimate:
 *
 * - N1 (seed 1101): the same directories as the development probe, renamed to words drawn from `PROBE_WORDS` with a
 *   seeded PRNG, and every source file moved one level deeper under a wrapper directory (`src/<w>/...`);
 * - N2 (seed 2202): new words again, and one extra directory level inserted *inside* every top-level directory
 *   (`src/<top>/<inner>/<sub>/...`; files directly in a top-level directory stay where they are);
 * - S (scrambled): N1's directories PLUS renamed class / file suffixes (`Repository` -> `Store`, `Controller` ->
 *   `Endpoint`, ...: `SCRAMBLE_SUFFIXES`), declared identifiers and file names alike, to see how far the edge
 *   structure carries without the naming vocabulary.
 *
 * A probe is a pure transform of project paths and globs, segment by segment (`probePath`), so the same transform maps
 * the project, its ground truth (expected layers, expected findings) and the true spec's globs. Evaluation code only;
 * src/ise never imports this.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReferenceStyle } from './reference-model.js';

/**
 * Neutral nouns the probe names are drawn from. Fixed before the draw; `probeWordsAllowed` removes any word that is a
 * token of an ISE vocabulary, a directory name of a reference project, or a development-probe name.
 */
export const PROBE_WORDS: readonly string[] = [
  'amber', 'anvil', 'aspen', 'basalt', 'beacon', 'birch', 'bramble', 'cairn', 'canyon', 'cedar', 'cinder', 'clover',
  'cobalt', 'comet', 'coral', 'cypress', 'delta', 'dune', 'ember', 'fern', 'fjord', 'flint', 'garnet', 'glacier',
  'granite', 'harbor', 'hazel', 'heron', 'indigo', 'iris', 'jasper', 'juniper', 'kelp', 'lagoon', 'larch', 'lichen',
  'linden', 'lotus', 'maple', 'marble', 'meadow', 'mesa', 'moss', 'nectar', 'nimbus', 'oasis', 'onyx', 'opal',
  'orchid', 'pebble', 'pine', 'plume', 'prairie', 'quartz', 'quill', 'raven', 'reef', 'ridge', 'saffron', 'sage',
  'sequoia', 'shale', 'sierra', 'slate', 'sorrel', 'spruce', 'summit', 'talon', 'thistle', 'tundra', 'umber',
  'valley', 'velvet', 'walnut', 'willow', 'yarrow', 'zephyr', 'zinnia',
];

/** Names the probes must not use (normalised: lower case, no `-_.`). */
export function probeWordsAllowed(exclude: readonly string[]): string[] {
  const banned = new Set(exclude.map((w) => w.toLowerCase().replace(/[-_.\s]/g, '')));
  return PROBE_WORDS.filter((w) => !banned.has(w));
}

/** mulberry32: a small seeded PRNG (deterministic across platforms). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` distinct words of `pool`, drawn with `rand` (partial Fisher-Yates). */
export function drawWords(pool: readonly string[], n: number, rand: () => number): string[] {
  if (n > pool.length) throw new Error(`drawWords: ${String(n)} > pool ${String(pool.length)}`);
  const a = [...pool];
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(rand() * (a.length - i));
    [a[i], a[j]] = [a[j] ?? '', a[i] ?? ''];
  }
  return a.slice(0, n);
}

/** Directories each probe renames, relative to `src/` (`*` = any directory at that position): the development set. */
export const PROBE_SLOTS: Readonly<Record<ReferenceStyle, readonly string[]>> = {
  'clean-architecture': ['domain', 'application', 'infrastructure'],
  layered: ['presentation', 'business', 'persistence'],
  nestjs: ['domain', 'common'],
  hexagonal: ['domain', 'application', 'adapters', 'adapters/inbound', 'adapters/outbound', 'config'],
  ddd: ['*/domain', '*/application', '*/infrastructure'],
};

/** Class-name / file-name suffixes the scrambled probe renames (PascalCase `XRepository`, kebab/dot `x.repository`). */
export const SCRAMBLE_SUFFIXES: Readonly<Record<string, string>> = {
  Repository: 'Store',
  Controller: 'Endpoint',
  Service: 'Handler',
  UseCase: 'Job',
  Gateway: 'Link',
  Adapter: 'Bridge',
  Dto: 'Payload',
  Module: 'Bundle',
  Guard: 'Sentry',
  Filter: 'Sieve',
};

export type ProbeNesting = 'root-wrapper' | 'inner-level' | 'none';

export interface ProbeDefinition {
  readonly id: string;
  readonly family: 'N1' | 'N2' | 'S';
  readonly style: ReferenceStyle;
  readonly seed: number;
  readonly nesting: ProbeNesting;
  /** root-wrapper: the directories inserted after `src/`. */
  readonly wrapper: readonly string[];
  /** inner-level: the directory inserted below every top-level directory. */
  readonly inner: string | null;
  /** Slot (see PROBE_SLOTS) -> the new name of its last segment. */
  readonly segments: Readonly<Record<string, string>>;
  /** Scrambled probe only. */
  readonly suffixes: Readonly<Record<string, string>>;
}

export const PROBE_SEEDS = { N1: 1101, N2: 2202 } as const;

/**
 * The held-out probe definitions. For each family one PRNG stream (its seed) draws, style by style in
 * `styles` order, one word per slot and then the nesting word(s). S reuses N1's directories.
 */
export function generateProbes(styles: readonly ReferenceStyle[], exclude: readonly string[]): ProbeDefinition[] {
  const pool = probeWordsAllowed(exclude);
  const out: ProbeDefinition[] = [];
  const n1: ProbeDefinition[] = [];
  for (const family of ['N1', 'N2'] as const) {
    const rand = mulberry32(PROBE_SEEDS[family]);
    for (const style of styles) {
      const slots = PROBE_SLOTS[style];
      const words = drawWords(pool, slots.length + 1, rand);
      const segments = Object.fromEntries(slots.map((s, i) => [s, words[i] ?? '']));
      const extra = words[slots.length] ?? '';
      const def: ProbeDefinition = {
        id: `${family}-${style}`,
        family,
        style,
        seed: PROBE_SEEDS[family],
        nesting: family === 'N1' ? 'root-wrapper' : 'inner-level',
        wrapper: family === 'N1' ? [extra] : [],
        inner: family === 'N2' ? extra : null,
        segments,
        suffixes: {},
      };
      out.push(def);
      if (family === 'N1') n1.push(def);
    }
  }
  for (const d of n1) out.push({ ...d, id: `S-${d.style}-scrambled`, family: 'S', suffixes: { ...SCRAMBLE_SUFFIXES } });
  return out;
}

/** The suffix-renamed form of a file or class base name (no extension). */
export function scrambleName(name: string, suffixes: Readonly<Record<string, string>>): string {
  for (const [from, to] of Object.entries(suffixes)) {
    if (name.endsWith(from) && name.length > from.length) return name.slice(0, -from.length) + to;
    const low = from.toLowerCase();
    for (const sep of ['.', '-']) {
      if (name.endsWith(sep + low)) return name.slice(0, -low.length) + to.toLowerCase();
    }
  }
  return name;
}

/** The last segment of a file path or file glob with the scrambled suffixes (`*.repository.ts` -> `*.store.ts`). */
function scrambleLast(p: string, def: ProbeDefinition): string {
  if (Object.keys(def.suffixes).length === 0) return p;
  const i = p.lastIndexOf('/');
  const last = p.slice(i + 1);
  if (last.includes('**')) return p;
  const at = last.search(/\.(d\.ts|tsx|ts|jsx|js)$/);
  const [stem, ext] = at > 0 ? [last.slice(0, at), last.slice(at)] : [last, ''];
  return p.slice(0, i + 1) + scrambleName(stem, def.suffixes) + ext;
}

/**
 * The probe form of a project-relative path or glob. `kind` says whether the last segment is a file (or file glob)
 * or a directory; for globs, directory segments from the first `**` on are left alone (a file glob's last segment is
 * still suffix-scrambled). A trailing `/` is kept.
 */
export function probePath(p: string, def: ProbeDefinition, kind: 'file' | 'dir'): string {
  if (p !== 'src' && !p.startsWith('src/')) return kind === 'file' ? scrambleLast(p, def) : p;
  const trailing = p.endsWith('/');
  const body = trailing ? p.slice(0, -1) : p;
  const segs = body === 'src' ? [] : body.slice(4).split('/');
  const lastIsDir = trailing || kind === 'dir';
  const stop = segs.findIndex((s) => s.includes('**'));
  const end = stop < 0 ? segs.length : stop;
  const dirCount = Math.min(end, lastIsDir ? segs.length : segs.length - 1);
  const out = [...segs];
  for (let i = 0; i < dirCount; i += 1) {
    for (const [slot, word] of Object.entries(def.segments)) {
      const ks = slot.split('/');
      if (ks.length !== i + 1) continue;
      if (ks[i] !== '*' && ks.every((k, j) => k === '*' || segs[j] === k)) out[i] = word;
    }
  }
  if (!lastIsDir && segs.length > 0) out[out.length - 1] = scrambleLast(segs[segs.length - 1] ?? '', def);
  // Nesting: a wrapper after src/, or an inner directory after the first segment when a directory follows it.
  if (def.nesting === 'inner-level' && def.inner !== null && dirCount >= 2) out.splice(1, 0, def.inner);
  const withWrapper = def.nesting === 'root-wrapper' ? [...def.wrapper, ...out] : out;
  const res = ['src', ...withWrapper].join('/');
  return trailing ? `${res}/` : res;
}

/** A finding path field (possibly a comma-separated cycle) in probe form. */
export function probeFindingPath(p: string, def: ProbeDefinition): string {
  return p.split(',').map((x) => probePath(x.trim(), def, 'file')).join(',');
}

export const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])(\.{1,2}\/[^'"]*)\2/gm;

/** Declared type / class / function names of `sources` that the scramble renames, old -> new. */
export function scrambledIdentifiers(sources: readonly string[], suffixes: Readonly<Record<string, string>>): Map<string, string> {
  const out = new Map<string, string>();
  if (Object.keys(suffixes).length === 0) return out;
  const decl = /\b(?:class|interface|type|enum|function|const)\s+([A-Za-z_]\w*)/g;
  const declared = new Set<string>();
  for (const s of sources) for (const m of s.matchAll(decl)) if (m[1] !== undefined) declared.add(m[1]);
  for (const name of declared) {
    const n = scrambleName(name, suffixes);
    if (n !== name) out.set(name, n);
  }
  // A new name may equal a name declared in another module (hexagonal v09 declares its own `RoomStore` next to the
  // adapter while the port `RoomRepository` becomes `RoomStore`): legal TypeScript as long as no module sees both,
  // which the probe check (every probed variant type-checks) verifies.
  return out;
}

/** Rewrites `source` (at `fromRel` before the probe): relative specifiers to the moved targets, then identifiers. */
export function rewriteProbeSource(source: string, fromRel: string, def: ProbeDefinition, dirs: ReadonlySet<string>, idents: ReadonlyMap<string, string>): string {
  const oldDir = path.posix.dirname(fromRel);
  const newDir = path.posix.dirname(probePath(fromRel, def, 'file'));
  let out = source.replace(SPECIFIER, (all: string, lead: string, q: string, spec: string) => {
    const target = path.posix.normalize(path.posix.join(oldDir, spec));
    const moved = probePath(target, def, dirs.has(target) ? 'dir' : 'file');
    let rel = path.posix.relative(newDir, moved);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel === spec ? all : `${lead}${q}${rel}${q}`;
  });
  if (idents.size > 0) {
    const names = [...idents.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp(`\\b(${names.join('|')})\\b`, 'g');
    out = out.replace(re, (m: string) => idents.get(m) ?? m);
  }
  return out;
}

/** Applies `def` to the project at `dir` in place: every file under src/ is moved and rewritten. */
export function applyProbe(dir: string, def: ProbeDefinition): void {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else files.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  const srcDir = path.join(dir, 'src');
  if (!fs.existsSync(srcDir)) throw new Error(`probe: ${dir} has no src/`);
  walk(srcDir);
  const dirs = new Set<string>();
  for (const f of files) {
    const segs = f.split('/');
    for (let i = 1; i < segs.length; i += 1) dirs.add(segs.slice(0, i).join('/'));
  }
  const contents = new Map(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  const idents = scrambledIdentifiers([...contents.entries()].filter(([f]) => f.endsWith('.ts')).map(([, t]) => t), def.suffixes);
  const moved = new Map<string, string>();
  for (const f of files) {
    const to = probePath(f, def, 'file');
    if ([...moved.values()].includes(to)) throw new Error(`probe ${def.id}: two files map to ${to}`);
    moved.set(f, to);
  }
  fs.rmSync(srcDir, { recursive: true, force: true });
  for (const [f, text] of contents) {
    const to = path.join(dir, moved.get(f) ?? f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, f.endsWith('.ts') ? rewriteProbeSource(text, f, def, dirs, idents) : text);
  }
}

/** A `pattern:` string of a fitness function (`*Repository|*Repo`) with the scrambled suffixes. */
export function scramblePattern(p: string, suffixes: Readonly<Record<string, string>>): string {
  return p.split('|').map((alt) => scrambleName(alt, suffixes)).join('|');
}
