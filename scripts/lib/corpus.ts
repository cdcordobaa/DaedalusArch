/**
 * Corpus types and `corpus/corpus.json` loading (FR-36; BR-U5b-66; U5b domain-entities §8).
 *
 * - `CorpusCandidate` / `CorpusEntry` / `CorpusCriteria` follow domain-entities §8 (CM:1819 amended).
 * - `validateCorpus` checks a value against `scripts/lib/schemas/corpus.schema.json`, then every overlay's `sha256`
 *   against the committed patch file (an entry whose overlay hash differs from its patch is rejected, BR-U5b-66).
 * - `parseCriteria` reads the ```yaml corpus-criteria machine block of `Docs/corpus-criteria.md` (BR-U5b-68).
 * - `corpusTiers` maps each entry to its reporting tier, `core` or `e7` (ADR-020 item 8).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import { parse as parseYaml } from 'yaml';
import type { CorpusTier } from './mutation/types.js';

export const CORPUS_SCHEMA = 'scripts/lib/schemas/corpus.schema.json';
export const CORPUS_FILE = 'corpus/corpus.json';
export const CRITERIA_DOC = 'Docs/corpus-criteria.md';
export const CORPUS_INVALID = 'CORPUS_INVALID';
export const OVERLAY_SHA_MISMATCH = 'OVERLAY_SHA_MISMATCH';

export type CorpusStyle = 'layered' | 'clean-architecture' | 'nestjs';

export interface CorpusCandidate {
  readonly name: string;
  readonly originUrl: string;
  readonly licence: string;
  readonly fileCount?: number;
  readonly style?: CorpusStyle;
  /** Default-branch HEAD at search time. */
  readonly commitSha?: string;
  readonly backend?: boolean;
  readonly hasPackageLock?: boolean;
  readonly isArchived?: boolean;
  readonly isFork?: boolean;
  readonly treeTruncated?: boolean;
  readonly queries?: readonly string[];
  /** E7-x round only (`Docs/corpus-criteria.md` §7.1): recorded, never satisfies C5. */
  readonly hasPnpmLock?: boolean;
  readonly hasYarnLock?: boolean;
  /** E7-x round only (§7.3): set for a candidate that passes C1–C6 of the round. */
  readonly attributes?: CandidateAttributes;
}

/** `Docs/corpus-criteria.md` §7.3 (ADR-027). P = E + H + F + R; `A` is recorded only. */
export interface CandidateAttributes {
  readonly E: 0 | 1;
  readonly H: 0 | 1;
  readonly F: 0 | 1;
  readonly R: 0 | 1;
  readonly P: number;
  readonly A: readonly string[];
  readonly evidence: {
    readonly enforcement: readonly string[];
    readonly readmeHexagonal: boolean;
    /** First matching first-parent commit touching `src/` (newest first), if any. */
    readonly fixCommit: { readonly sha: string; readonly subject: string } | null;
    readonly commits: number;
    readonly contributors: number;
    readonly hasTests: boolean;
  };
}

export interface CorpusOverlay { readonly path: string; readonly patchFile: string; readonly sha256: string }
export type CorpusInstall = { readonly policy: 'none' } | { readonly policy: 'npm-ci-ignore-scripts'; readonly lockSha256: string };
export interface CorpusTsc { readonly kind: 'project' | 'repo-pinned'; readonly tscPath: string; readonly tscVersion: string }

export interface CorpusEntry extends CorpusCandidate {
  readonly commitSha: string;
  /** One of the five projects of `Docs/corpus.md` (ADR-015 item 3). */
  readonly core: boolean;
  readonly licenceNote?: string;
  /** `corpus/specs/<project>.yaml`. */
  readonly specPath: string;
  readonly overlays: readonly CorpusOverlay[];
  readonly install: CorpusInstall;
  readonly tsc: CorpusTsc;
  /** Project directory inside the clone (ghostfolio `apps/api`). */
  readonly subPath?: string;
  /** Relative to the project directory; default `tsconfig.json`. */
  readonly tsconfigPath?: string;
  /** ADR-019 item 2 base-preparation steps, run by `prepare-bases` (`scripts/lib/base-preparation.ts`). */
  readonly preparation?: readonly ('prisma-generate' | 'monorepo-context')[];
}

export interface CorpusFile { readonly version: number; readonly entries: readonly CorpusEntry[] }

export interface CorpusCriteria {
  readonly version: number;
  readonly licences: readonly string[];
  readonly minFiles: number;
  readonly maxFiles: number;
  readonly styles: readonly CorpusStyle[];
  readonly styleOrder: readonly CorpusStyle[];
  readonly backendPackages: readonly string[];
  readonly preferLayered: boolean;
  readonly addMin: number;
  readonly addMax: number;
  readonly seed: number;
  /** Extension E7-x (§7, ADR-027); absent in a round-1-only block. */
  readonly extension?: CorpusExtension;
}

export interface CorpusExtension {
  readonly id: string;
  readonly registeredOn: string;
  readonly minFiles: number;
  readonly maxFiles: number;
  readonly addMin: number;
  readonly addMax: number;
  readonly seed: number;
  readonly ownerCap: number;
  readonly hexagonalQueries: readonly string[];
  readonly hexagonalReadme: string;
  readonly enforcementFiles: readonly string[];
  readonly enforcementPackages: readonly string[];
  readonly fixMessage: string;
  readonly fixPathPrefix: string;
  readonly realMinContributors: number;
  readonly realMinCommits: number;
  readonly aiFiles: readonly string[];
}

export const sha256Hex = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

const validators = new Map<string, ValidateFunction>();

function schemaErrors(value: unknown, repoRoot: string): string[] {
  const key = resolve(repoRoot, CORPUS_SCHEMA);
  let v = validators.get(key);
  if (v === undefined) {
    const ajv = new Ajv({ strict: true, allErrors: true });
    v = ajv.compile(JSON.parse(readFileSync(key, 'utf8')) as Record<string, unknown>);
    validators.set(key, v);
  }
  return v(value) ? [] : (v.errors ?? []).map((e) => `${e.instancePath === '' ? '/' : e.instancePath} ${e.message ?? 'invalid'}`);
}

/**
 * Schema errors plus overlay-hash and uniqueness errors. `patchRoot` resolves `patchFile` (default `repoRoot`).
 * Empty = valid.
 */
export function validateCorpus(value: unknown, repoRoot: string, patchRoot: string = repoRoot): string[] {
  const errors = schemaErrors(value, repoRoot);
  if (errors.length > 0) return errors.map((e) => `${CORPUS_INVALID}: ${e}`);
  const file = value as CorpusFile;
  const seen = new Set<string>();
  file.entries.forEach((e, i) => {
    if (seen.has(e.name)) errors.push(`${CORPUS_INVALID}: /entries/${String(i)} duplicate name ${e.name}`);
    seen.add(e.name);
    e.overlays.forEach((o, j) => {
      const p = join(patchRoot, o.patchFile);
      if (!existsSync(p)) {
        errors.push(`${OVERLAY_SHA_MISMATCH}: /entries/${String(i)}/overlays/${String(j)} patch file ${o.patchFile} missing`);
        return;
      }
      const actual = sha256Hex(readFileSync(p));
      if (actual !== o.sha256) errors.push(`${OVERLAY_SHA_MISMATCH}: /entries/${String(i)}/overlays/${String(j)} ${o.patchFile} sha256 ${actual} ≠ ${o.sha256}`);
    });
  });
  return errors;
}

export function loadCorpus(path: string, repoRoot: string, patchRoot: string = repoRoot): { ok: true; corpus: CorpusFile } | { ok: false; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`${CORPUS_INVALID}: ${path}: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const errors = validateCorpus(value, repoRoot, patchRoot);
  return errors.length === 0 ? { ok: true, corpus: value as CorpusFile } : { ok: false, errors };
}

/** Project name → corpus tier: `core` for the five `core: true` entries, `e7` for every added entry (ADR-020 item 8). */
export function corpusTiers(file: Pick<CorpusFile, 'entries'>): Map<string, CorpusTier> {
  return new Map(file.entries.map((e) => [e.name, e.core ? 'core' : 'e7'] as const));
}

/** Project name → corpus `style` for the entries that record one (ADR-021 SO1-C). */
export function corpusStyles(file: Pick<CorpusFile, 'entries'>): Map<string, CorpusStyle> {
  return new Map(file.entries.flatMap((e) => (e.style === undefined ? [] : [[e.name, e.style] as const])));
}

const BLOCK = /^```yaml corpus-criteria[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

/** Parses the single machine block of `Docs/corpus-criteria.md`; throws on a missing, duplicated or malformed block. */
export function parseCriteria(doc: string): CorpusCriteria {
  const blocks = [...doc.matchAll(BLOCK)];
  if (blocks.length !== 1) throw new Error(`${CRITERIA_DOC}: expected one \`\`\`yaml corpus-criteria block, found ${String(blocks.length)}`);
  const raw = parseYaml(blocks[0]?.[1] ?? '') as Record<string, unknown>;
  const num = (k: string): number => {
    const v = raw[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new Error(`${CRITERIA_DOC}: ${k} must be a non-negative integer`);
    return v;
  };
  const list = (k: string): string[] => {
    const v = raw[k];
    if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === 'string')) throw new Error(`${CRITERIA_DOC}: ${k} must be a non-empty string list`);
    return v;
  };
  const styles = list('styles');
  const known: readonly string[] = ['layered', 'clean-architecture', 'nestjs'];
  for (const s of [...styles, ...list('styleOrder')]) if (!known.includes(s)) throw new Error(`${CRITERIA_DOC}: unknown style ${s}`);
  if (typeof raw.preferLayered !== 'boolean') throw new Error(`${CRITERIA_DOC}: preferLayered must be a boolean`);
  const c: CorpusCriteria = {
    version: num('version'), licences: list('licences'), minFiles: num('minFiles'), maxFiles: num('maxFiles'),
    styles: styles as CorpusStyle[], styleOrder: list('styleOrder') as CorpusStyle[], backendPackages: list('backendPackages'),
    preferLayered: raw.preferLayered, addMin: num('addMin'), addMax: num('addMax'), seed: num('seed'),
  };
  if (c.minFiles > c.maxFiles || c.addMin > c.addMax || c.addMin < 1) throw new Error(`${CRITERIA_DOC}: inconsistent bounds`);
  if (raw.extension === undefined) return c;
  return { ...c, extension: parseExtension(raw.extension) };
}

function parseExtension(v: unknown): CorpusExtension {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${CRITERIA_DOC}: extension must be a map`);
  const raw = v as Record<string, unknown>;
  const num = (k: string): number => {
    const x = raw[k];
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 0) throw new Error(`${CRITERIA_DOC}: extension.${k} must be a non-negative integer`);
    return x;
  };
  const str = (k: string): string => {
    const x = raw[k];
    // `registeredOn` may be read by YAML as a date-like string; it is always quoted or plain text here.
    if (typeof x !== 'string' || x.length === 0) throw new Error(`${CRITERIA_DOC}: extension.${k} must be a non-empty string`);
    return x;
  };
  const list = (k: string): string[] => {
    const x = raw[k];
    if (!Array.isArray(x) || x.length === 0 || !x.every((y) => typeof y === 'string')) throw new Error(`${CRITERIA_DOC}: extension.${k} must be a non-empty string list`);
    return x;
  };
  const e: CorpusExtension = {
    id: str('id'), registeredOn: str('registeredOn'), minFiles: num('minFiles'), maxFiles: num('maxFiles'), addMin: num('addMin'),
    addMax: num('addMax'), seed: num('seed'), ownerCap: num('ownerCap'), hexagonalQueries: list('hexagonalQueries'),
    hexagonalReadme: str('hexagonalReadme'), enforcementFiles: list('enforcementFiles'), enforcementPackages: list('enforcementPackages'),
    fixMessage: str('fixMessage'), fixPathPrefix: str('fixPathPrefix'), realMinContributors: num('realMinContributors'),
    realMinCommits: num('realMinCommits'), aiFiles: list('aiFiles'),
  };
  if (e.minFiles > e.maxFiles || e.addMin > e.addMax || e.addMin < 1 || e.ownerCap < 1) throw new Error(`${CRITERIA_DOC}: inconsistent extension bounds`);
  new RegExp(e.hexagonalReadme, 'i');
  new RegExp(e.fixMessage, 'i');
  return e;
}
