/**
 * S12 archive step of a loop out-root (readiness gate S12). Entry file: no exports. Library and definitions:
 * `scripts/lib/loop/archive.ts`. No model call, no Neo4j, no network.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/loop-archive.ts --out-root <abs> --tar <file.tar> --manifest <file.json> [--check-paths <dir>]...
 *   npx tsx scripts/v1.4/loop-archive.ts --out-root <abs> --verify <manifest.json>
 *   npx tsx scripts/v1.4/loop-archive.ts --check-paths <dir>...
 *
 * Archive: writes the deterministic ustar (outside the out-root) and the manifest (relative paths, sha256 per file,
 * `manifestSha256`, `tarSha256`); commit the manifest, keep the tarball where the author archives raw outputs.
 * Verify: recomputes the manifest of the out-root and compares it with the committed one.
 * `--check-paths`: every text file under each directory (the committed results) holds no absolute home path and no
 * secret shape; hits print file, line and kind only.
 * Exit codes: 0 done and clean, 1 a verify difference or a path-free hit, 2 usage or I/O error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { archiveOutRoot, scanPathFree, verifyManifest } from '../lib/loop/archive.js';
import type { ArchiveManifest } from '../lib/loop/archive.js';

const argv = process.argv.slice(2);
const one = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const many = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1] as string] : []));

try {
  const outRoot = one('--out-root');
  const tar = one('--tar');
  const manifestFile = one('--manifest');
  const verify = one('--verify');
  const checks = many('--check-paths');
  const archiving = outRoot !== undefined && verify === undefined;
  if ((outRoot === undefined && checks.length === 0) || (archiving && (tar === undefined || manifestFile === undefined))) {
    process.stderr.write('usage: loop-archive.ts --out-root <abs> (--tar <f> --manifest <f> | --verify <manifest>) [--check-paths <dir>]...\n');
    process.exit(2);
  }
  let failed = false;
  if (outRoot !== undefined && verify !== undefined) {
    const committed = JSON.parse(fs.readFileSync(verify, 'utf8')) as ArchiveManifest;
    const problems = verifyManifest(path.resolve(outRoot), committed);
    for (const p of problems) process.stdout.write(`VERIFY ${p}\n`);
    process.stdout.write(
      problems.length === 0 ? `verify: ${String(committed.files)} files, manifestSha256 ${committed.manifestSha256} OK\n` : `verify: ${String(problems.length)} difference(s)\n`,
    );
    failed ||= problems.length > 0;
  } else if (outRoot !== undefined && tar !== undefined && manifestFile !== undefined) {
    const m = archiveOutRoot(path.resolve(outRoot), path.resolve(tar));
    fs.mkdirSync(path.dirname(path.resolve(manifestFile)), { recursive: true });
    fs.writeFileSync(manifestFile, `${JSON.stringify(m, null, 1)}\n`);
    process.stdout.write(
      `archive: ${String(m.files)} files, ${String(m.bytes)} bytes, ${String(m.skippedLinks)} links skipped\nmanifestSha256 ${m.manifestSha256}\ntarSha256 ${m.tarSha256 ?? ''}\n`,
    );
  }
  for (const dir of checks) {
    const hits = scanPathFree(path.resolve(dir));
    for (const h of hits) process.stdout.write(`PATH-FREE ${dir}/${h.file}:${String(h.line)} ${h.kind}\n`);
    process.stdout.write(`path-free ${dir}: ${String(hits.length)} hit(s)\n`);
    failed ||= hits.length > 0;
  }
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
