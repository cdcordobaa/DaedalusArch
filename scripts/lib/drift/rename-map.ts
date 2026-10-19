/**
 * The rename map ρ between two snapshots (ID-9), parsed from `git diff --name-status -M50% -l5000 <a> <b> -- <path>`,
 * the command `nameStatus` runs in `scripts/v1.3/fixes-mined-run.ts`. Pure: `git-rename.ts` produces the input.
 *
 * Counting matches `nameStatus` exactly (`changed` = every row, `renamedOrDeleted` = R and D rows, the prefix stripped
 * when present). Unlike `nameStatus` it keeps the destination of an R row. A C (copy) row is not a rename: the old
 * path stays. A rename whose destination lies outside the analysis root has no successor (ID-10): its old path goes to
 * `outOfRoot`, not to `rename`. A rename into the root from outside is an addition.
 */
import type { RenameMap } from './types.js';

export interface NameStatusParse {
  /** old -> new, both inside the root, prefix stripped. */
  readonly rename: RenameMap;
  /** Old paths renamed to a destination outside the root. */
  readonly outOfRoot: ReadonlySet<string>;
  /** Every R row's old path, as `nameStatus` reports it (the legacy `renamedFrom` of `classifyDisappearance`). */
  readonly renamedFrom: ReadonlySet<string>;
  readonly deleted: ReadonlySet<string>;
  readonly changed: number;
  readonly renamedOrDeleted: number;
}

/** `rootPrefix`: the analysis root (`'.'` or `''` for the repository root; a trailing `/` is optional). */
export function parseNameStatus(text: string, rootPrefix: string): NameStatusParse {
  const prefix = rootPrefix === '' || rootPrefix === '.' ? '' : rootPrefix.endsWith('/') ? rootPrefix : `${rootPrefix}/`;
  const inRoot = (p: string): boolean => prefix === '' || p.startsWith(prefix);
  const strip = (p: string): string => (prefix !== '' && p.startsWith(prefix) ? p.slice(prefix.length) : p);
  const rename = new Map<string, string>();
  const outOfRoot = new Set<string>();
  const renamedFrom = new Set<string>();
  const deleted = new Set<string>();
  let changed = 0;
  let renamedOrDeleted = 0;
  for (const line of text.split('\n')) {
    if (line === '') continue;
    const [st = '', a = '', b = ''] = line.split('\t');
    changed++;
    if (st.startsWith('R')) {
      renamedFrom.add(strip(a));
      renamedOrDeleted++;
      if (!inRoot(a)) continue; // renamed into the root from outside: an addition
      if (b === '' || !inRoot(b)) outOfRoot.add(strip(a));
      else rename.set(strip(a), strip(b));
    } else if (st === 'D') {
      deleted.add(strip(a));
      renamedOrDeleted++;
    }
    // A (added), M (modified), T (type change), C (copy: the old path stays): no identity change.
  }
  return { rename, outOfRoot, renamedFrom, deleted, changed, renamedOrDeleted };
}
