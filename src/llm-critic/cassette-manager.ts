import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CassetteEntry } from './types.js';

/**
 * Save a cassette entry to disk.
 */
export function saveCassette(basePath: string, entry: CassetteEntry): void {
  fs.mkdirSync(basePath, { recursive: true });
  const filePath = cassettePath(basePath, entry.functionId, entry.runIndex);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
}

/**
 * Load a cassette entry from disk. Returns null if not found.
 */
export function loadCassette(basePath: string, functionId: string, runIndex: number): CassetteEntry | null {
  const filePath = cassettePath(basePath, functionId, runIndex);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CassetteEntry;
}

/**
 * Check if a cassette exists.
 */
export function cassetteExists(basePath: string, functionId: string, runIndex: number): boolean {
  return fs.existsSync(cassettePath(basePath, functionId, runIndex));
}

function cassettePath(basePath: string, functionId: string, runIndex: number): string {
  return path.join(basePath, `${functionId}_${runIndex}.json`);
}
