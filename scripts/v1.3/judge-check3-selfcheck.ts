/**
 * CHECK-3 static self-check (`Docs/v1.3/judge-check3-plan.md` §3). No Neo4j, no model: it reads files only.
 *
 * Confirms that no clean base of the set carries a known seed pattern, i.e. that a clean or twin unit cannot fail for
 * a construct the seeds are meant to plant. The patterns are the static signatures of the CHECK-2/CHECK-3 operators:
 *
 *   SP-REPO-BYPASS-GLOBAL   a global ORM handle: `new PrismaClient(`, a bare `getRepository(` or a Mongoose `model(` /
 *                           `model<` (AP-REPO-BYPASS), in any file outside an infrastructure-kind layer (a repository
 *                           implementation's own `dataSource.getRepository(...)` is where ORM access belongs)
 *   SP-REPO-BYPASS-FACADE   a layered business-layer file that imports the persistence layer's ORM facade
 *                           (`PrismaService`) or `@prisma/client`: the shape every CHECK-2 layered base carried
 *   SP-PERSIST-IN-DOMAIN    a domain-kind file that imports `typeorm` or uses `@Entity(` / `@Column(` (AP-PERSIST-IN-DOMAIN)
 *   SP-FRAMEWORK-LEAK       a domain- or application-kind file that imports `express` (AP-FRAMEWORK-LEAK)
 *   SP-DOMAIN-HOLDS-INFRA   on clean-architecture, hexagonal and ddd: a domain-kind file that imports an
 *                           infrastructure-kind file (MO-DF01)
 *   SP-OPERATOR-CUE         an operator literal or parameter cue: `'u5a'` (MO-DF01n), `request?:` / `context?:`
 *                           (AP-FRAMEWORK-LEAK/n)
 *   SP-COMMENT              a comment line (the bases carry none)
 * AP-FAT-CONTROLLER has no static signature (a moved parameter rule), so it is not checked here.
 *
 * Also checked, for CHECK-3: every layered base has a seeding-only overlay, the overlay DOES carry
 * SP-REPO-BYPASS-FACADE (positive control: the check can see the pattern), the committed seed manifest's tree hashes
 * equal the bases on disk, and every non-layered base is byte-identical to its CHECK-2 manifest entry. With
 * `--work <dir>` (a `seed --set check3 --out <dir>` work dir) the twin copies of REPO-BYPASS are scanned too, and each
 * layered AP-REPO-BYPASS seed copy must carry SP-REPO-BYPASS-GLOBAL.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/judge-check3-selfcheck.ts [--set check3|check2] [--work <dir>] [--out <file.json>]
 * Exit 0 when every check holds. `--set check2` is expected to FAIL (it finds the CHECK-2 defect).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { parse } from 'yaml';
import { CHECK_SETS, RESULTS22, SEED_OVERLAY, overlayFilesOf, sha256, treeSha256 } from './judge-v22-check2.js';
import type { Check2Base, CheckSet } from './judge-v22-check2.js';

const REPO = process.cwd();

export interface Finding {
  readonly scope: string;
  readonly file: string;
  readonly pattern: string;
  readonly line: string;
}

interface Layer {
  readonly kind: string;
  readonly match: (rel: string) => boolean;
}

function layersOf(specFile: string): Layer[] {
  const spec = parse(fs.readFileSync(specFile, 'utf8')) as { architecture?: { layers?: { name: string; kind?: string; directories?: string[] }[] } };
  return (spec.architecture?.layers ?? []).map((l) => ({ kind: l.kind ?? l.name, match: picomatch(l.directories ?? []) }));
}

const kindOf = (layers: readonly Layer[], rel: string): string => layers.find((l) => l.match(rel))?.kind ?? '';

function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) out.push(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

const importsOf = (text: string): string[] => [...text.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1] ?? '');

/** Seed-pattern findings in one project's `src/`, given its evaluation spec and style. */
export function scanProject(projectDir: string, specFile: string, style: string, scope: string): Finding[] {
  const layers = layersOf(specFile);
  const out: Finding[] = [];
  const hit = (file: string, pattern: string, line: string): void => {
    out.push({ scope, file, pattern, line: line.trim() });
  };
  for (const abs of sources(path.join(projectDir, 'src'))) {
    const rel = path.relative(projectDir, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split('\n');
    const kind = kindOf(layers, rel);
    const imports = importsOf(text);
    for (const l of lines) {
      if (kind !== 'infrastructure' && /new PrismaClient\(|(^|[^.\w])(getRepository|model)\s*[<(]/.test(l)) hit(rel, 'SP-REPO-BYPASS-GLOBAL', l);
      if (/'u5a'|\brequest\?:|\bcontext\?:/.test(l)) hit(rel, 'SP-OPERATOR-CUE', l);
      if (/(^|\s)(\/\/|\/\*)/.test(l)) hit(rel, 'SP-COMMENT', l);
    }
    if (style === 'layered' && rel.startsWith('src/business/')) {
      for (const i of imports) if (/(^|\/)PrismaService$|^@prisma\//.test(i)) hit(rel, 'SP-REPO-BYPASS-FACADE', `import ${i}`);
    }
    if (kind === 'domain') {
      for (const i of imports) if (i === 'typeorm') hit(rel, 'SP-PERSIST-IN-DOMAIN', `import ${i}`);
      for (const l of lines) if (/@(Entity|Column)\(/.test(l)) hit(rel, 'SP-PERSIST-IN-DOMAIN', l);
    }
    if (kind === 'domain' || kind === 'application') {
      for (const i of imports) if (i === 'express') hit(rel, 'SP-FRAMEWORK-LEAK', `import ${i}`);
    }
    if (kind === 'domain' && ['clean-architecture', 'hexagonal', 'ddd'].includes(style)) {
      for (const i of imports.filter((x) => x.startsWith('.'))) {
        const target = path.relative(projectDir, path.resolve(path.dirname(abs), i)).split(path.sep).join('/');
        if (kindOf(layers, `${target}.ts`) === 'infrastructure') hit(rel, 'SP-DOMAIN-HOLDS-INFRA', `import ${i}`);
      }
    }
  }
  return out;
}

interface ManifestLike {
  readonly bases: readonly { baseId: string; treeSha256: string; overlayFiles?: string[] }[];
  readonly rows: readonly { rowId: string; family: string; operatorId: string; role: string; style: string; copyDir: string; specPath: string }[];
}

const readManifest = (file: string): ManifestLike | undefined => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestLike) : undefined);

export interface SelfCheck {
  readonly set: string;
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly what: string; readonly holds: boolean; readonly detail: string }[];
  readonly findings: readonly Finding[];
}

export function selfCheck(set: CheckSet, work: string | undefined): SelfCheck {
  const baseDir = (b: Check2Base): string => path.resolve(REPO, b.root ?? set.root, b.baseId);
  const findings: Finding[] = [];
  for (const b of set.bases) findings.push(...scanProject(path.join(baseDir(b), 'project'), path.join(baseDir(b), 'spec.yaml'), b.style, `base:${b.baseId}`));
  const checks: SelfCheck['checks'][number][] = [];
  checks.push({ id: 'S1', what: 'no clean base carries a known seed pattern', holds: findings.length === 0, detail: `${String(findings.length)} finding(s)` });

  const layered = set.bases.filter((b) => b.style === 'layered');
  if (set.key === 'check3') {
    const control = layered.map((b) => {
      const dir = path.join(baseDir(b), SEED_OVERLAY);
      const hits = overlayFilesOf(b).length === 0 ? [] : scanOverlay(dir, b.baseId);
      return { b, hits };
    });
    const missing = control.filter((c) => !c.hits.some((h) => h.pattern === 'SP-REPO-BYPASS-FACADE')).map((c) => c.b.baseId);
    checks.push({ id: 'S2', what: 'positive control: every layered seed-overlay carries SP-REPO-BYPASS-FACADE', holds: missing.length === 0, detail: missing.length === 0 ? `${String(layered.length)}/${String(layered.length)}` : `missing: ${missing.join(', ')}` });
    const overlayComments = control.flatMap((c) => c.hits.filter((h) => h.pattern === 'SP-COMMENT'));
    checks.push({ id: 'S3', what: 'the seed-overlays carry no comment', holds: overlayComments.length === 0, detail: `${String(overlayComments.length)} comment line(s)` });

    const m3 = readManifest(path.resolve(REPO, set.results, `${set.key}-seed-manifest.json`));
    const stale = set.bases.filter((b) => m3?.bases.find((x) => x.baseId === b.baseId)?.treeSha256 !== treeSha256(path.join(baseDir(b), 'project'))).map((b) => b.baseId);
    checks.push({ id: 'S4', what: 'the committed CHECK-3 manifest was built from these bases (tree sha256)', holds: m3 !== undefined && stale.length === 0, detail: m3 === undefined ? 'no manifest' : stale.length === 0 ? 'all equal' : `differ: ${stale.join(', ')}` });

    const m2 = readManifest(path.resolve(REPO, RESULTS22, 'check2-seed-manifest.json'));
    const others = set.bases.filter((b) => b.style !== 'layered');
    const moved = others.filter((b) => m2?.bases.find((x) => x.baseId === b.baseId)?.treeSha256 !== treeSha256(path.join(baseDir(b), 'project'))).map((b) => b.baseId);
    checks.push({ id: 'S5', what: 'every non-layered base is byte-identical to CHECK-2', holds: m2 !== undefined && moved.length === 0, detail: moved.length === 0 ? `${String(others.length)}/${String(others.length)} equal` : `moved: ${moved.join(', ')}` });
  }

  if (work !== undefined) {
    const manifest = readManifest(path.join(work, 'seed-manifest.json'));
    const rows = manifest?.rows ?? [];
    const twins = rows.filter((r) => r.role === 'twin' && r.family === 'REPO-BYPASS');
    const twinHits = twins.flatMap((r) => scanProject(path.join(work, r.copyDir), path.resolve(REPO, r.specPath), r.style, r.rowId)
      .filter((f) => f.pattern.startsWith('SP-REPO-BYPASS') || f.pattern === 'SP-DOMAIN-HOLDS-INFRA'));
    checks.push({ id: 'S6', what: 'no REPO-BYPASS twin copy carries a bypass pattern', holds: twins.length > 0 && twinHits.length === 0, detail: `${String(twins.length)} twin(s), ${String(twinHits.length)} finding(s)` });
    findings.push(...twinHits);
    const seeds = rows.filter((r) => r.role === 'seed' && r.operatorId === 'AP-REPO-BYPASS' && r.style === 'layered');
    const blind = seeds.filter((r) => !scanProject(path.join(work, r.copyDir), path.resolve(REPO, r.specPath), r.style, r.rowId).some((f) => f.pattern === 'SP-REPO-BYPASS-GLOBAL')).map((r) => r.rowId);
    checks.push({ id: 'S7', what: 'positive control: every layered AP-REPO-BYPASS seed copy carries SP-REPO-BYPASS-GLOBAL', holds: seeds.length > 0 && blind.length === 0, detail: blind.length === 0 ? `${String(seeds.length)}/${String(seeds.length)}` : `not seen: ${blind.join(', ')}` });
  }
  return { set: set.set, ok: checks.every((c) => c.holds), checks, findings };
}

/** Findings in an overlay dir (files laid out as in `project/`); scanned as a layered business layer. */
function scanOverlay(dir: string, baseId: string): Finding[] {
  const out: Finding[] = [];
  for (const abs of sources(path.join(dir, 'src'))) {
    const rel = path.relative(dir, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');
    if (rel.startsWith('src/business/')) for (const i of importsOf(text)) if (/(^|\/)PrismaService$|^@prisma\//.test(i)) out.push({ scope: `overlay:${baseId}`, file: rel, pattern: 'SP-REPO-BYPASS-FACADE', line: `import ${i}` });
    for (const l of text.split('\n')) if (/(^|\s)(\/\/|\/\*)/.test(l)) out.push({ scope: `overlay:${baseId}`, file: rel, pattern: 'SP-COMMENT', line: l.trim() });
  }
  return out;
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv: readonly string[]): number {
  const key = arg(argv, '--set') ?? 'check3';
  if (key !== 'check2' && key !== 'check3') {
    process.stderr.write('--set must be check2 or check3\n');
    return 2;
  }
  const work = arg(argv, '--work');
  const r = selfCheck(CHECK_SETS[key], work === undefined ? undefined : path.resolve(work));
  for (const c of r.checks) process.stdout.write(`${c.holds ? 'ok  ' : 'FAIL'} ${c.id} ${c.what}: ${c.detail}\n`);
  for (const f of r.findings) process.stdout.write(`  ${f.pattern} ${f.scope} ${f.file}: ${f.line}\n`);
  process.stdout.write(`${r.set} self-check: ${r.ok ? 'PASS' : 'FAIL'}\n`);
  const out = arg(argv, '--out');
  if (out !== undefined) {
    const text = `${JSON.stringify({ ...r, scriptSha256: sha256(fs.readFileSync(path.resolve(REPO, 'scripts/v1.3/judge-check3-selfcheck.ts'))) }, null, 2)}\n`;
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(path.resolve(out), text);
  }
  return r.ok ? 0 : 1;
}

if (process.argv[1]?.endsWith('judge-check3-selfcheck.ts') === true) process.exitCode = main(process.argv.slice(2));
