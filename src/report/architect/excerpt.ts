/**
 * Code excerpts for the architect HTML report. Reads source files of the evaluated project only: the path must stay
 * inside the project root, have a source extension and not look like an environment or secrets file.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';

export interface ExcerptLine {
  readonly n: number;
  readonly text: string;
  /** The line the finding points at. */
  readonly hit: boolean;
}

export interface CodeExcerpt {
  readonly file: string;
  readonly lines: readonly ExcerptLine[];
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const MAX_FILE_BYTES = 1_000_000;
const CONTEXT_LINES = 2;
const MAX_EXCERPT_LINES = 14;
const MAX_LINE_CHARS = 240;

/** True when `file` (project-relative) may be read for an excerpt. */
export function isReadableSource(projectRoot: string, file: string): boolean {
  if (file === '' || isAbsolute(file)) return false;
  const abs = resolve(projectRoot, file);
  const rel = relative(resolve(projectRoot), abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return false;
  const name = basename(abs).toLowerCase();
  if (name.startsWith('.env') || /secret|credential/.test(name)) return false;
  return SOURCE_EXTENSIONS.has(extname(name));
}

/** Reads project files at most once per report. */
export class SourceReader {
  private readonly cache = new Map<string, readonly string[] | null>();

  constructor(private readonly projectRoot: string | undefined) {}

  lines(file: string): readonly string[] | null {
    if (this.projectRoot === undefined) return null;
    const hit = this.cache.get(file);
    if (hit !== undefined) return hit;
    let out: readonly string[] | null = null;
    if (isReadableSource(this.projectRoot, file)) {
      const abs = resolve(this.projectRoot, file);
      try {
        if (existsSync(abs) && statSync(abs).isFile() && statSync(abs).size <= MAX_FILE_BYTES) {
          out = readFileSync(abs, 'utf-8').replace(/\r\n?/g, '\n').split('\n');
        }
      } catch {
        out = null;
      }
    }
    this.cache.set(file, out);
    return out;
  }

  /** Lines around `hits` (1-based), with the hit lines marked; null without a readable file or a line in range. */
  excerpt(file: string, hits: readonly number[]): CodeExcerpt | null {
    const src = this.lines(file);
    if (src === null) return null;
    const inRange = [...new Set(hits)].filter((n) => Number.isInteger(n) && n >= 1 && n <= src.length).sort((a, b) => a - b);
    const first = inRange[0];
    if (first === undefined) return null;
    const last = inRange[inRange.length - 1] ?? first;
    const start = Math.max(1, first - CONTEXT_LINES);
    const end = Math.min(src.length, last + CONTEXT_LINES, start + MAX_EXCERPT_LINES - 1);
    const hitSet = new Set(inRange);
    const lines: ExcerptLine[] = [];
    for (let n = start; n <= end; n++) {
      const raw = src[n - 1] ?? '';
      const text = raw.length > MAX_LINE_CHARS ? `${raw.slice(0, MAX_LINE_CHARS)}…` : raw;
      lines.push({ n, text, hit: hitSet.has(n) });
    }
    return { file, lines };
  }
}
