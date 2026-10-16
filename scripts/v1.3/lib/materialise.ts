/**
 * Materialises a reference-project variant (FR-V3): copies the clean project to a directory and applies the
 * variant's patch (patch format) or its delete list and overlay (overlay format, DDD) to the copy. The clean
 * project in the repository is never written.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyUnifiedDiff } from './unified-diff.js';
import type { PatchTarget } from './unified-diff.js';
import type { LoadedReference, LoadedVariant, VariantOverlay } from './reference-model.js';

/** A `PatchTarget` over a directory on disk; refuses paths that leave it. */
export function directoryTarget(root: string): PatchTarget {
  const resolve = (rel: string): string => {
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`patch path escapes the project: ${rel}`);
    return abs;
  };
  return {
    read: (rel) => {
      const abs = resolve(rel);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : undefined;
    },
    write: (rel, content) => {
      const abs = resolve(rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    },
    remove: (rel) => { fs.rmSync(resolve(rel), { force: true }); },
  };
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

/**
 * Applies an overlay-format variant (U-C1) to a copy of the clean project: deletes the listed files (each must
 * exist), then copies every overlay file on top. Returns the project-relative paths touched.
 */
export function applyOverlay(overlay: VariantOverlay, dest: string): string[] {
  const target = directoryTarget(dest);
  const touched = new Set<string>();
  for (const rel of overlay.delete) {
    if (target.read(rel) === undefined) throw new Error(`delete list names ${rel}, which the clean project does not have`);
    target.remove(rel);
    touched.add(rel);
  }
  for (const rel of listFiles(overlay.dir)) {
    target.write(rel, fs.readFileSync(path.join(overlay.dir, rel), 'utf8'));
    touched.add(rel);
  }
  if (touched.size === 0) throw new Error('the overlay changes nothing');
  return [...touched].sort();
}

export interface MaterialisedVariant {
  readonly style: string;
  readonly variant: string;
  /** Absolute path of the materialised project (has its own tsconfig.json). */
  readonly projectDir: string;
  /** Project-relative paths the patch touched (empty for the clean variant). */
  readonly touched: readonly string[];
}

/**
 * Copies `ref.projectDir` to `<destRoot>/<style>/<variant>` (replacing what is there) and applies the patch.
 * Throws when the patch does not apply cleanly; the half-built copy is removed.
 */
export function materialiseVariant(ref: LoadedReference, variant: LoadedVariant, destRoot: string): MaterialisedVariant {
  const dest = path.resolve(destRoot, ref.style, variant.manifest.variant);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(ref.projectDir, dest, { recursive: true });
  let touched: string[] = [];
  if (ref.format === 'overlay') {
    // The overlay format keeps the clean manifest inside clean/; it is not part of the project.
    fs.rmSync(path.join(dest, 'expected-findings.json'), { force: true });
    if (variant.overlay !== undefined) {
      try {
        touched = applyOverlay(variant.overlay, dest);
      } catch (e) {
        fs.rmSync(dest, { recursive: true, force: true });
        throw new Error(`${ref.style}/${variant.manifest.variant}: overlay does not apply: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else if (variant.patchPath !== null) {
    try {
      touched = applyUnifiedDiff(fs.readFileSync(variant.patchPath, 'utf8'), directoryTarget(dest));
    } catch (e) {
      fs.rmSync(dest, { recursive: true, force: true });
      throw new Error(`${ref.style}/${variant.manifest.variant}: patch does not apply: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { style: ref.style, variant: variant.manifest.variant, projectDir: dest, touched };
}

/** A fresh temporary directory for materialised variants. */
export function makeTempRoot(prefix = 'v13-reference-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
