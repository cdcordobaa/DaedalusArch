/**
 * Ontology v0 content-hash cache, which is also the cassette store.
 *
 * The key is the SHA-256 of the canonical JSON of everything that decides an answer: the prompt-template version,
 * the pass, the provider and model, and the hashes of the system prompt, the JSON schema and the prompt (which holds
 * the class source, its APG neighbourhood and the cheap facts), plus the run index. An unchanged class therefore hits
 * the cache, and a changed one misses it.
 *
 * Modes: `record` answers from the store and calls the provider on a miss, then writes the entry; `replay` answers
 * from the store only (a miss is counted and the item is invalid); `off` always calls and writes nothing.
 * Layout: `<dir>/<key[0..2]>/<key>.json`, keys sorted, written atomically.
 */
import { canonicalJSON, sha256Hex } from '../../llm-critic/canonical-json.js';
import { readCassetteEntry, sortedJson, writeFileAtomic, cassetteFilePath } from './cassette-io.js';
import type { PassId } from './types.js';

export type CacheMode = 'record' | 'replay' | 'off';

export const ONTOLOGY_CACHE_SCHEMA_VERSION = 1;

export interface CacheKeyParts {
  readonly promptVersion: string;
  readonly pass: PassId;
  readonly provider: string;
  readonly model: string;
  readonly systemHash: string;
  readonly schemaHash: string;
  readonly promptHash: string;
  readonly runIndex: number;
}

export function cacheKeyOf(parts: CacheKeyParts): string {
  return sha256Hex(canonicalJSON(parts));
}

export interface CacheEntry {
  readonly schemaVersion: typeof ONTOLOGY_CACHE_SCHEMA_VERSION;
  readonly key: string;
  readonly parts: CacheKeyParts;
  readonly itemId: string;
  readonly itemName: string;
  /** Absent when the run was asked to omit prompts. */
  readonly prompt?: string;
  readonly response: unknown;
  readonly resolvedModel: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  readonly recordedAt: string;
}

export class OntologyCache {
  private readonly memo = new Map<string, CacheEntry>();

  constructor(readonly mode: CacheMode, readonly dir: string | null) {
    if (mode !== 'off' && dir === null) throw new Error(`cache mode ${mode} needs a directory`);
  }

  get(key: string): CacheEntry | null {
    const m = this.memo.get(key);
    if (m !== undefined) return m;
    if (this.mode === 'off' || this.dir === null) return null;
    const e = readCassetteEntry(this.dir, key) as CacheEntry | null;
    if (e !== null) this.memo.set(key, e);
    return e;
  }

  put(entry: CacheEntry): void {
    this.memo.set(entry.key, entry);
    if (this.mode !== 'record' || this.dir === null) return;
    writeFileAtomic(cassetteFilePath(this.dir, entry.key), sortedJson(entry));
  }
}
