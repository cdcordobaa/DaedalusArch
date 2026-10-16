/**
 * One string order for outputs that are serialised or hashed (R13, post-merge review 2026-10-16). A bare
 * `localeCompare` follows the host locale (LANG / LC_ALL): a da-DK host sorts 'aa' after 'z'. This collator is pinned
 * to en-US, the order the committed ontology and APG v2 outputs were produced in, so every host gives the same bytes.
 */
const COLLATOR = new Intl.Collator('en-US');

export function hostIndependentCompare(a: string, b: string): number {
  return COLLATOR.compare(a, b);
}
