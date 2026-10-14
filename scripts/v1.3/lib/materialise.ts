/**
 * Materialises a reference-project variant (FR-V3): copies the clean project to a directory and applies the
 * variant's patch to the copy. The clean project in the repository is never written.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyUnifiedDiff } from './unified-diff.js';
import type { PatchTarget } from './unified-diff.js';
import type { LoadedReference, LoadedVariant } from './reference-model.js';

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
    remove: (rel) => fs.rmSync(resolve(rel), { force: true }),
  };
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
  if (variant.patchPath !== null) {
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
