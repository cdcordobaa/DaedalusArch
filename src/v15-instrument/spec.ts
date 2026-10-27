/**
 * v1.5 instrument (Stage 0, 2026-10-26): promoted from `experiments/detect-02/lib/spec.ts`; the logic is unchanged and the
 * prototype stays in place as the record of the exploratory runs.
 *
 * DETECT-02 (v1.5-exp): what the detectors read from a spec. The spec is the instrument's YAML (`architecture.layers`,
 * `architecture.ddd`), read here with a plain YAML parser so a frozen loader is not touched; a tree with no spec falls
 * back to the DETECT-01 folder conventions (`../../detect-01/lib/layers.ts`).
 *
 * The experimental allowance overlay `detect02.allow.yaml` (next to the spec or at the tree root) is read only here:
 *   allow:
 *     - rule: R-D4
 *       command: src/x/application/ImportAccounts.ts#execute   # file#method; `*` as method allows the whole file
 *       reason: declared batch command
 *
 * Declared invariants (C1, 2026-10-26; `ops/notes/d5-declared-invariants-design.md` §3), optional, v1.5 only:
 *   architecture.ddd.invariants:
 *     - { id: room-no-overlap, kind: set, owner: RoomSchedule, over: [Booking], terms: [roomId, checkIn, checkOut] }
 *     - { id: order-number-unique, kind: uniqueness, over: [Order], terms: [orderNumber], enforced_by: store }
 * An invalid entry is dropped and reported in `specErrors`; a spec without the field behaves as before.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import YAML from 'yaml';
import { roleOf as conventionRole } from './conventions.js';

export type Role = 'domain' | 'application' | 'port' | 'contract' | 'adapter' | 'composition' | 'shared-kernel' | 'other';

export interface ContextDecl { readonly name: string; readonly root: string; readonly publicApi: readonly string[]; readonly acl: readonly string[] }
export interface AggregateDecl { readonly name: string; readonly context: string; readonly module: string; readonly root: string; readonly innerEntities: readonly string[] }
export type InvariantKind = 'set' | 'single' | 'uniqueness';
export interface InvariantDecl {
  readonly id: string; readonly kind: InvariantKind; readonly owner: string | null; readonly over: readonly string[];
  readonly terms: readonly string[]; readonly statement: string; readonly enforcedBy: string | null;
}
export interface Allowance { readonly rule: string; readonly command: string; readonly reason: string }

export interface DetectSpec {
  readonly source: 'spec' | 'conventions';
  readonly style: string;
  readonly contexts: readonly ContextDecl[];
  readonly aggregates: readonly AggregateDecl[];
  readonly repositories: readonly string[];
  readonly domainEventTypes: readonly string[];
  readonly allow: readonly Allowance[];
  readonly invariants: readonly InvariantDecl[];
  readonly specErrors: readonly string[];
  roleOf(file: string): Role;
  contextOf(file: string): string | null;
  isPublished(file: string): boolean;
}

interface RawLayer { name?: string; kind?: string; directories?: string[]; roles?: string[] }

/** The DDD preset's declared repository globs (presets/ddd.yaml), used when a tree declares none. */
export const DEFAULT_REPOSITORIES = ['src/*/domain/**/*Repository.ts', 'src/*/infrastructure/**/*Repository.ts'];

const match = (globs: readonly string[], file: string): boolean => globs.some((g) => picomatch(g, { dot: true })(file));

/** Find the spec of a tree: an explicit path, else `spec.yaml` or `.firewall/spec.yaml` or `firewall.yaml` at the root. */
export function findSpec(tree: string, explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit;
  for (const c of ['spec.yaml', '.firewall/spec.yaml', 'firewall.yaml', 'architecture.yaml']) {
    const p = path.join(tree, c);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function readAllow(files: readonly string[]): Allowance[] {
  const out: Allowance[] = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const doc = YAML.parse(fs.readFileSync(f, 'utf8')) as { allow?: { rule?: string; command?: string; reason?: string }[] } | null;
    for (const a of doc?.allow ?? []) if (a.rule && a.command) out.push({ rule: a.rule, command: a.command, reason: a.reason ?? '' });
  }
  return out;
}

export function loadSpec(tree: string, specPath?: string, styleHint?: string): DetectSpec {
  const found = findSpec(tree, specPath);
  const allowFiles = [path.join(tree, 'detect02.allow.yaml'), ...(found ? [path.join(path.dirname(found), 'detect02.allow.yaml')] : [])];
  const allow = readAllow([...new Set(allowFiles)]);
  const doc = found ? (YAML.parse(fs.readFileSync(found, 'utf8')) as { architecture?: Record<string, unknown> } | null) : null;
  const arch = (doc?.architecture ?? {}) as { style?: string; layers?: RawLayer[]; ddd?: Record<string, unknown> };
  const ddd = (arch.ddd ?? {}) as {
    contexts?: { name: string; root: string; public_api?: string[]; acl?: string[] }[];
    aggregates?: { name: string; context: string; module: string; root: string; inner_entities?: string[] }[];
    repositories?: string[]; domain_event_types?: string[]; outside_contexts?: string[];
    invariants?: { id?: string; kind?: string; owner?: string; over?: string[]; terms?: string[]; statement?: string; enforced_by?: string }[];
  };
  const contexts: ContextDecl[] = (ddd.contexts ?? []).map((c) => ({ name: c.name, root: c.root, publicApi: c.public_api ?? [], acl: c.acl ?? [] }));
  const aggregates: AggregateDecl[] = (ddd.aggregates ?? []).map((a) => ({ name: a.name, context: a.context, module: a.module, root: a.root, innerEntities: a.inner_entities ?? [] }));
  const specErrors: string[] = [];
  const invariants: InvariantDecl[] = [];
  for (const [i, v] of (ddd.invariants ?? []).entries()) {
    const where = `ddd.invariants[${String(i)}]${v.id ? ` (${v.id})` : ''}`;
    const kind = v.kind as InvariantKind | undefined;
    if (!v.id) { specErrors.push(`${where}: id is missing`); continue; }
    if (kind !== 'set' && kind !== 'single' && kind !== 'uniqueness') { specErrors.push(`${where}: kind must be set, single or uniqueness`); continue; }
    if (!Array.isArray(v.terms) || v.terms.length === 0) { specErrors.push(`${where}: terms must be a non-empty list`); continue; }
    if (kind === 'uniqueness') {
      if (v.enforced_by !== 'store' || v.owner !== undefined) { specErrors.push(`${where}: a uniqueness invariant needs enforced_by: store and no owner`); continue; }
    } else if (!v.owner || !aggregates.some((a) => a.name === v.owner)) { specErrors.push(`${where}: owner must name a declared aggregate`); continue; }
    invariants.push({ id: v.id, kind, owner: v.owner ?? null, over: v.over ?? [], terms: v.terms, statement: v.statement ?? '', enforcedBy: v.enforced_by ?? null });
  }
  const layers = arch.layers ?? [];
  const style = arch.style ?? styleHint ?? 'unknown';

  const roleOf = (file: string): Role => {
    if (/(^|\/)shared-kernel\//.test(file)) return 'shared-kernel';
    if (/(^|\/)contracts\//.test(file)) return 'contract';
    if (contexts.some((c) => match(c.publicApi, file))) return 'contract';
    if (layers.length > 0) {
      const l = layers.find((x) => match(x.directories ?? [], file));
      if (l === undefined) return /(^|\/)main\.ts$/.test(file) ? 'composition' : 'other';
      if ((l.roles ?? []).includes('composition-root') || /^(config|composition)$/.test(l.name ?? '')) return 'composition';
      if (l.kind === 'domain') return 'domain';
      if (l.kind === 'application') return /\/ports?\//.test(file) ? 'port' : 'application';
      return 'adapter';
    }
    const r = conventionRole(file, style === 'layered' ? 'layered' : 'hexddd');
    switch (r) {
      case 'port-in': case 'port-out': return 'port';
      case 'config': return 'composition';
      default: return r as Role;
    }
  };
  const contextOf = (file: string): string | null => {
    const c = contexts.find((x) => file.startsWith(x.root));
    if (c) return c.name;
    if (contexts.length > 0) return null;
    // Fallback: src/<ctx>/{domain,application,...}/ is a context folder.
    const m = /^src\/([^/]+)\/(domain|application|infrastructure|acl|api|adapters|contracts)\//.exec(file);
    return m ? m[1]! : null;
  };
  const isPublished = (file: string): boolean =>
    contexts.some((c) => match(c.publicApi, file)) || /(^|\/)contracts\//.test(file) || /\/ports\/in\//.test(file)
    || (/^src\/[^/]+\/index\.ts$/.test(file) && contextOf(file) !== null);
  return {
    source: found ? 'spec' : 'conventions', style, contexts, aggregates,
    repositories: ddd.repositories ?? DEFAULT_REPOSITORIES, domainEventTypes: ddd.domain_event_types ?? ['DomainEvent'], allow, invariants, specErrors,
    roleOf, contextOf, isPublished,
  };
}

export const globMatch = match;
