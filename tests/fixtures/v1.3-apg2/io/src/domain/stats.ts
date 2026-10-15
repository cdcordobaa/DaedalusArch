// NM-IO3: a type-only import of a forbidden package, no call. v1.3 domain-purity reports the import;
// APG v2 sees no I/O. The two rules are different constructs.
import type { Stats } from 'fs';
export function sizeOf(s: Stats): number {
  return s.size;
}
