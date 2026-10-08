/**
 * Exclude anchors inside template text (BR-U1-32, domain-entities.md §3.8): a Cypher block comment
 * holding `EXCLUDE:<alias>` or `EXCLUDE:nodes(<path>)`. Group 1 = path variable, group 2 = node alias.
 */
export const EXCLUDE_MARKER_RE = /\/\*EXCLUDE:(?:nodes\((\w+)\)|(\w+))\*\//g;

/**
 * Replace every exclude marker in `text`: with the `$excludePatterns` predicate when the function has
 * exclude paths, with the empty string otherwise.
 */
export function replaceExcludeMarkers(text: string, hasExcludes: boolean): string {
  return text.replace(EXCLUDE_MARKER_RE, (_m: string, pathVar: string | undefined, alias: string | undefined) => {
    if (!hasExcludes) return '';
    if (pathVar !== undefined) {
      return `AND NONE(n IN nodes(${pathVar}) WHERE ANY(ep IN $excludePatterns WHERE n.filePath =~ ep))`;
    }
    return `AND NONE(ep IN $excludePatterns WHERE ${String(alias)}.filePath =~ ep)`;
  });
}

/** True when `text` holds at least one exclude marker (C7, BR-U1-32). */
export function hasExcludeMarker(text: string): boolean {
  return new RegExp(EXCLUDE_MARKER_RE.source).test(text);
}
