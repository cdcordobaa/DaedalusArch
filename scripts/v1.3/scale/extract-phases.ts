/**
 * Extraction phase breakdown for Docs/v1.3/scale.md (no Neo4j). Entry file: no exports.
 *
 * Times the four phases of `extractAPG` separately: the ts-morph project load (parsing), the type checker (program
 * creation, which `extractAPG` otherwise triggers lazily inside the node pass), the node pass and the edge pass, and
 * the process peak RSS. `--code <root>` loads the extractor from another checkout (the baseline worktree), so the
 * same script measures before and after. Run one project per process.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/scale/extract-phases.ts --project <dir> --tsconfig <file> [--code <repo root>] \
 *     [--skip-excluded-sources] [--out <file.json>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import picomatch from 'picomatch';
import { Project, ts } from 'ts-morph';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

interface ExtractorModules {
  readonly types: { DEFAULT_OPTIONS: Record<string, unknown>; DEFAULT_EXCLUDE_PATTERNS: string[] };
  readonly nodes: { extractNodes: (files: unknown[], root: string, opts: unknown) => { lookup: unknown } };
  readonly edges: { extractEdges: (files: unknown[], lookup: unknown, root: string, opts: unknown) => { edges: unknown[] } };
}

async function load(code: string): Promise<ExtractorModules> {
  const mod = async <T>(rel: string): Promise<T> => (await import(pathToFileURL(path.join(code, rel)).href)) as T;
  return {
    types: await mod('src/apg-extractor/types.ts'),
    nodes: await mod('src/apg-extractor/node-extractor.ts'),
    edges: await mod('src/apg-extractor/edge-extractor.ts'),
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const project = arg(argv, '--project');
  const tsconfig = arg(argv, '--tsconfig');
  if (project === undefined || tsconfig === undefined) {
    process.stderr.write('usage: extract-phases.ts --project <dir> --tsconfig <file> [--code <root>] [--skip-excluded-sources] [--out <file>]\n');
    return 2;
  }
  const m = await load(path.resolve(arg(argv, '--code') ?? process.cwd()));
  const root = path.resolve(project);
  const isExcluded = picomatch(m.types.DEFAULT_EXCLUDE_PATTERNS, { dot: true });
  const analysed = (f: string): boolean => !isExcluded(path.relative(root, f));
  const skip = argv.includes('--skip-excluded-sources');
  const ms = (t: number): number => Math.round(performance.now() - t);

  let t = performance.now();
  let p: Project;
  if (skip) {
    const read = ts.readConfigFile(tsconfig, (file) => ts.sys.readFile(file));
    const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, path.dirname(path.resolve(tsconfig)), undefined, tsconfig);
    p = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
    for (const f of parsed.fileNames) if (ts.sys.fileExists(f) && (f.endsWith('.d.ts') || analysed(f))) p.addSourceFileAtPath(f);
  } else {
    p = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: false, skipFileDependencyResolution: true });
  }
  const loadMs = ms(t);
  const loaded = p.getSourceFiles().length;
  t = performance.now();
  void p.getTypeChecker().compilerObject;
  const checkerMs = ms(t);
  const files = p.getSourceFiles().filter((sf) => analysed(sf.getFilePath()));
  const opts = { ...m.types.DEFAULT_OPTIONS };
  t = performance.now();
  const { lookup } = m.nodes.extractNodes(files, root, opts);
  const nodeMs = ms(t);
  t = performance.now();
  const { edges } = m.edges.extractEdges(files, lookup, root, opts);
  const edgeMs = ms(t);
  const result = {
    project: path.basename(root), skipExcludedSources: skip, loadedFiles: loaded, analysedFiles: files.length, edges: edges.length,
    loadMs, checkerMs, nodeMs, edgeMs, totalMs: loadMs + checkerMs + nodeMs + edgeMs,
    peakRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
  };
  const out = arg(argv, '--out');
  if (out !== undefined) fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  process.stderr.write(`${JSON.stringify(result)}\n`);
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 1;
  },
);
