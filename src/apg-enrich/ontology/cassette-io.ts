/** File helpers of the ontology cassette store (the judge's `cassette-manager` helpers, with an ontology entry type). */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sortedJson, writeFileAtomic } from '../../llm-critic/cassette-manager.js';

export { sortedJson, writeFileAtomic };

export function cassetteFilePath(dir: string, key: string): string {
  return path.join(dir, key.slice(0, 2), `${key}.json`);
}

/** The parsed entry stored under `key`, or null; the caller types it. */
export function readCassetteEntry(dir: string, key: string): unknown {
  const file = cassetteFilePath(dir, key);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}
