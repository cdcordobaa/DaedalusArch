// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./vega-lite-module.d.ts" />
/**
 * Figure rendering (FR-36; BR-U5b-72; D-U5b-5). Every `scripts/lib/figures/*.vl.json` names its source CSV and its
 * SVG in `usermeta`; `drawFigures` reads the CSV (the canonical artefact), compiles the Vega-Lite spec and renders
 * SVG in Node with `vega.View(...).toSVG()` (renderer `none`, no canvas package). The same CSV gives byte-identical
 * SVG. vega 6 and vega-lite 6 are ESM-only with top-level await, so both are loaded by dynamic `import()`; run this
 * from the tsx / ESM entry (`aggregate-cli.ts`), not from a CommonJS jest module (OI-U5b-P2-2).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const FIGURES_DIR = 'scripts/lib/figures';

export interface FigureSpec {
  readonly name: string;
  readonly csv: string;
  readonly svg: string;
  readonly spec: Record<string, unknown>;
}

/** Parses RFC 4180 CSV text (quoted cells with doubled quotes) into header and rows. */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? '';
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); records.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); records.push(row); }
  const [header = [], ...body] = records;
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

/** The figure specs of `scripts/lib/figures/`, sorted by file name. */
export function loadFigureSpecs(repoRoot: string): FigureSpec[] {
  const dir = join(repoRoot, FIGURES_DIR);
  return readdirSync(dir).filter((f) => f.endsWith('.vl.json')).sort().map((f) => {
    const spec = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
    const meta = spec.usermeta as { csv?: string; svg?: string } | undefined;
    if (meta?.csv === undefined || meta.svg === undefined) throw new Error(`${FIGURES_DIR}/${f}: usermeta.csv and usermeta.svg are required`);
    return { name: f, csv: meta.csv, svg: meta.svg, spec };
  });
}

/** Renders one spec over CSV text to SVG text. */
export async function renderSvg(spec: Record<string, unknown>, csvText: string): Promise<string> {
  const vega = await import('vega');
  const vl = await import('vega-lite');
  const { rows } = parseCsv(csvText);
  const withData = { ...spec, data: { values: rows } };
  delete (withData as { usermeta?: unknown }).usermeta;
  const compiled = vl.compile(withData as Parameters<typeof vl.compile>[0]).spec;
  const view = new vega.View(vega.parse(compiled), { renderer: 'none' });
  return view.toSVG();
}

/**
 * Renders every figure whose CSV exists in `csvDir` into `outDir`. Returns the SVG file names written, in order.
 * `writeFile` is injected so callers control where bytes land.
 */
export async function drawFigures(repoRoot: string, csvDir: string, writeFile: (path: string, text: string) => void, outDir: string = csvDir): Promise<string[]> {
  const written: string[] = [];
  for (const f of loadFigureSpecs(repoRoot)) {
    const csvPath = resolve(csvDir, f.csv);
    if (!existsSync(csvPath)) continue;
    writeFile(resolve(outDir, f.svg), await renderSvg(f.spec, readFileSync(csvPath, 'utf8')));
    written.push(f.svg);
  }
  return written;
}
