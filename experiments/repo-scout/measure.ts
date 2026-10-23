/**
 * REPO-SCOUT for COMPREHEND-02 (v1.5-exp, exploratory): measure candidate repositories for a comprehension test at scale.
 * Zero model calls. Clones live in a scratch directory outside this repository; nothing from them is committed.
 *
 * Per repository (an analysis root inside a pinned clone):
 *   - files and LOC: the production `.ts`/`.tsx` files of the harness program (tests and declarations excluded), and
 *     their non-blank lines;
 *   - tsc: the TypeScript compiler's diagnostics over the same program WITHOUT installed dependencies, split into
 *     "a module could not be found" (expected without `node_modules`) and every other error;
 *   - boundary signals read from the tree (ADR files, architecture or context docs, NestJS `@Module`, package
 *     manifests, lint boundary rules), recorded as counts; the judgement is made by hand in the report;
 *   - licence: the first lines of the licence file(s), classified by SPDX family.
 *
 * The harness tsconfig is the v1.3 wild one (`flattenTsconfig`, imported read-only from `scripts/v1.3/lib/wild.ts`),
 * written next to the analysis root in the scratch clone only. Candidates may add `include` globs and `paths`.
 *
 * Usage: npx tsx experiments/repo-scout/measure.ts <clones-dir> <candidates.json> <out.json>
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { flattenTsconfig } from '../../scripts/v1.3/lib/wild.js';

export interface Candidate {
  readonly id: string; readonly set: string; readonly url: string; readonly sha: string;
  /** Analysis root inside the clone. */
  readonly root: string;
  /** The repository's own tsconfig, relative to the root. */
  readonly tsconfig: string;
  readonly include?: readonly string[];
  /** Extra `paths` (relative to the root), e.g. workspace packages mapped to their sources. */
  readonly paths?: Readonly<Record<string, readonly string[]>>;
  /** Extra exclude globs (test files named in a repository's own convention, e.g. `*.e2e.ts`). */
  readonly exclude?: readonly string[];
  readonly licenceRecorded?: string;
}

export const HARNESS = 'tsconfig.scout.json';
/** Diagnostics that only say a module (a package, usually) could not be resolved or has no types. */
export const MISSING_MODULE_CODES = new Set([2307, 2792, 7016, 2875, 2688, 2834, 2835]);

const posix = (p: string): string => p.split(path.sep).join('/');

function licenceOf(clone: string, root: string): { files: string[]; family: string } {
  const files: string[] = [];
  for (const dir of [...new Set([path.join(clone, root), clone])]) {
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (/^(licen[cs]e|copying)/i.test(f) && fs.statSync(path.join(dir, f)).isFile()) files.push(path.join(dir, f));
  }
  const text = files.map((f) => fs.readFileSync(f, 'utf8').slice(0, 4000)).join('\n');
  const family = /GNU AFFERO|AGPL/i.test(text) ? 'AGPL' : /GNU GENERAL PUBLIC|GPL/i.test(text) ? 'GPL' : /Apache License/i.test(text) ? 'Apache-2.0'
    : /Permission is hereby granted, free of charge/i.test(text) ? 'MIT' : /ISC License|Permission to use, copy, modify, and\/or distribute/i.test(text) ? 'ISC'
      : /Mozilla Public License/i.test(text) ? 'MPL-2.0' : /BSD/i.test(text) ? 'BSD' : files.length === 0 ? 'none found' : 'other';
  return { files: files.map((f) => posix(path.relative(clone, f))), family };
}

function boundarySignals(clone: string, rootAbs: string, programFiles: readonly string[]): Record<string, number | string[]> {
  const tracked = spawnSync('git', ['ls-files'], { cwd: clone, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout.split('\n').filter(Boolean);
  const adr = tracked.filter((f) => /(^|\/)(adrs?|architecture-decisions?|decisions)\/.*\.mdx?$/i.test(f) || /(^|\/)adr[-_ ]?\d+.*\.mdx?$/i.test(f));
  const archDocs = tracked.filter((f) => /(^|\/)(ARCHITECTURE|CONTEXT|CONTEXT-MAP|DESIGN)\.mdx?$/i.test(f) || /(^|\/)docs?\/.*architecture.*\.mdx?$/i.test(f));
  const lintBoundary = tracked.filter((f) => /\.dependency-cruiser\.(c?js|json)$/.test(f) || /(^|\/)(\.eslintrc[^/]*|eslint\.config\.[cm]?[jt]s)$/.test(f))
    .filter((f) => /boundaries\/|no-restricted-imports|forbidden|enforce-module-boundaries|depConstraints|no-relative-monorepo-imports/.test(fs.readFileSync(path.join(clone, f), 'utf8')));
  const rootRel = posix(path.relative(clone, rootAbs));
  const manifests = tracked.filter((f) => f.endsWith('package.json') && (rootRel === '' || f.startsWith(`${rootRel}/`) || f === `${rootRel}/package.json`));
  let nestModules = 0;
  let medusaModules = 0;
  for (const f of programFiles) {
    const t = fs.readFileSync(f, 'utf8');
    nestModules += (t.match(/@Module\(\s*\{/g) ?? []).length;
    medusaModules += (t.match(/\bModule\(\s*Modules\.|\bModule\(\s*[A-Z_]+_MODULE\b/g) ?? []).length;
  }
  const topFolders = [...new Set(programFiles.map((f) => posix(path.relative(rootAbs, f)).split('/').slice(0, 2).join('/')).filter((s) => s.includes('/')))].length;
  return { adrFiles: adr.length, adrSample: adr.slice(0, 5), archDocs: archDocs.length, archDocSample: archDocs.slice(0, 5), lintBoundaryConfigs: lintBoundary, packageManifests: manifests.length, nestModuleDecorators: nestModules, medusaModuleDefinitions: medusaModules, secondLevelFolders: topFolders };
}

function workspacePackageFile(clone: string, spec: string): string | undefined {
  const m = /^(@[^/]+\/[^/]+|[^/]+)(\/.*)?$/.exec(spec);
  if (!m) return undefined;
  const found = spawnSync('git', ['ls-files', '*package.json'], { cwd: clone, encoding: 'utf8', maxBuffer: 1 << 26 }).stdout.split('\n').filter(Boolean);
  for (const f of found) {
    try {
      const pj = JSON.parse(fs.readFileSync(path.join(clone, f), 'utf8')) as { name?: string };
      if (pj.name === m[1]) {
        const target = path.join(clone, path.dirname(f), m[2] ?? 'tsconfig.json');
        return fs.existsSync(target) ? target : fs.existsSync(`${target}.json`) ? `${target}.json` : undefined;
      }
    } catch { /* not JSON */ }
  }
  return undefined;
}

export interface Measure {
  readonly id: string; readonly set: string; readonly url: string; readonly sha: string; readonly headMatches: boolean; readonly root: string;
  readonly files: number; readonly loc: number; readonly tsc: { total: number; missingModule: number; other: number; otherByCode: Record<string, number>; ms: number };
  readonly licence: { files: string[]; family: string; recorded?: string }; readonly boundaries: Record<string, number | string[]>; readonly notes: string[];
}

export function measure(clones: string, c: Candidate): Measure {
  const clone = path.join(clones, c.id);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).stdout.trim();
  const rootAbs = path.join(clone, c.root);
  const reader = {
    read: (p: string): Record<string, unknown> | undefined => {
      if (!fs.existsSync(p)) return undefined;
      const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
      return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
    },
    resolvePackage: (spec: string): string | undefined => workspacePackageFile(clone, spec),
  };
  const flat = flattenTsconfig(path.join(rootAbs, c.tsconfig), rootAbs, reader, c.include ?? ['src/**/*.ts', 'src/**/*.tsx']);
  const cfg = flat.tsconfig;
  if (c.exclude) cfg.exclude = [...cfg.exclude, ...c.exclude];
  if (c.paths) {
    cfg.compilerOptions.paths = { ...(cfg.compilerOptions.paths as Record<string, string[]> | undefined), ...c.paths };
    cfg.compilerOptions.baseUrl ??= '.';
  }
  const harness = path.join(rootAbs, HARNESS);
  fs.writeFileSync(harness, `${JSON.stringify(cfg, null, 2)}\n`);
  const parsed = ts.getParsedCommandLineOfConfigFile(harness, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  const names = (parsed?.fileNames ?? []).filter((f) => !f.endsWith('.d.ts'));
  let loc = 0;
  for (const f of names) loc += fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
  const t0 = Date.now();
  // SCOUT_NO_TSC=1: count files, LOC, licence and boundaries only (used for the copyleft repositories, which fail (e)).
  if (process.env.SCOUT_NO_TSC === '1') {
    const lic0 = licenceOf(clone, c.root);
    return {
      id: c.id, set: c.set, url: c.url, sha: c.sha, headMatches: head === c.sha, root: c.root, files: names.length, loc,
      tsc: { total: -1, missingModule: -1, other: -1, otherByCode: {}, ms: 0 },
      licence: { ...lic0, ...(c.licenceRecorded !== undefined ? { recorded: c.licenceRecorded } : {}) },
      boundaries: boundarySignals(clone, rootAbs, names), notes: [...flat.notes.map((n) => n.split(`${posix(clone)}/`).join('')), 'tsc not run (SCOUT_NO_TSC)'],
    };
  }
  const program = ts.createProgram({ rootNames: parsed?.fileNames ?? [], options: { ...(parsed?.options ?? {}), noEmit: true, types: process.env.SCOUT_TYPES ? process.env.SCOUT_TYPES.split(',') : [] } });
  const diags = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics(), ...program.getOptionsDiagnostics()]
    .filter((d) => d.category === ts.DiagnosticCategory.Error);
  const ms = Date.now() - t0;
  const otherByCode: Record<string, number> = {};
  let missing = 0;
  for (const d of diags) {
    if (MISSING_MODULE_CODES.has(d.code)) missing++;
    else otherByCode[`TS${d.code}`] = (otherByCode[`TS${d.code}`] ?? 0) + 1;
  }
  const lic = licenceOf(clone, c.root);
  return {
    id: c.id, set: c.set, url: c.url, sha: c.sha, headMatches: head === c.sha, root: c.root,
    files: names.length, loc,
    tsc: { total: diags.length, missingModule: missing, other: diags.length - missing, otherByCode, ms },
    licence: { ...lic, ...(c.licenceRecorded !== undefined ? { recorded: c.licenceRecorded } : {}) },
    boundaries: boundarySignals(clone, rootAbs, names),
    notes: flat.notes.map((n) => n.split(`${posix(clone)}/`).join('')),
  };
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [clones, candFile, outFile] = process.argv.slice(2);
  if (!clones || !candFile || !outFile) { process.stderr.write('usage: measure.ts <clones-dir> <candidates.json> <out.json>\n'); process.exit(2); }
  const cands = JSON.parse(fs.readFileSync(candFile, 'utf8')) as Candidate[];
  const only = process.env.SCOUT_ONLY?.split(',');
  const prev: Measure[] = fs.existsSync(outFile) ? (JSON.parse(fs.readFileSync(outFile, 'utf8')) as Measure[]) : [];
  const out = new Map(prev.map((m) => [m.id, m] as const));
  for (const c of cands) {
    if (only && !only.includes(c.id)) continue;
    try {
      const m = measure(clones, c);
      out.set(c.id, m);
      process.stdout.write(`${c.id}\t${m.files} files\t${m.loc} LOC\ttsc ${m.tsc.total} (${m.tsc.missingModule} missing-module, ${m.tsc.other} other)\t${m.licence.family}\t${m.headMatches ? 'sha ok' : 'SHA MISMATCH'}\n`);
    } catch (err) {
      process.stdout.write(`${c.id}\tERROR ${(err as Error).message}\n`);
    }
    fs.writeFileSync(outFile, `${JSON.stringify([...out.values()], null, 1)}\n`);
  }
}
