import { globToRegex } from './glob-to-regex.js';

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

export interface ExcludeInjectionResult {
  readonly cypher: string;
  readonly additionalParams: Readonly<Record<string, unknown>>;
}

/**
 * Inject WHERE NOT clause for exclude_paths into a compiled Cypher query.
 * Returns the original cypher unchanged if excludePaths is empty.
 *
 * The injected predicate filters out violations where the violating file
 * matches any of the exclude patterns.
 */
export function injectExcludePaths(
  cypher: string,
  excludePaths: readonly string[],
): ExcludeInjectionResult {
  if (excludePaths.length === 0) {
    return { cypher, additionalParams: {} };
  }

  const regexPatterns = excludePaths.map(globToRegex);

  // Find the node alias used in the RETURN clause that refers to the violating file.
  // Common patterns: "RETURN source.filePath", "RETURN n.filePath", "RETURN file.filePath"
  const nodeAlias = detectNodeAlias(cypher);

  // Insert the exclude clause before the RETURN
  const returnIdx = cypher.lastIndexOf('RETURN');
  if (returnIdx === -1) {
    // No RETURN clause — append as WHERE clause
    return {
      cypher: cypher + ` WHERE NONE(ep IN $excludePatterns WHERE ${nodeAlias}.filePath =~ ep)`,
      additionalParams: { excludePatterns: regexPatterns },
    };
  }

  const excludeClause = `AND NONE(ep IN $excludePatterns WHERE ${nodeAlias}.filePath =~ ep) `;
  const injected = cypher.slice(0, returnIdx) + excludeClause + cypher.slice(returnIdx);

  return {
    cypher: injected,
    additionalParams: { excludePatterns: regexPatterns },
  };
}

/**
 * Detect the node alias from a Cypher query's RETURN clause.
 * Looks for patterns like "source.filePath" or "n.filePath" in the RETURN.
 * Falls back to "source" if no filePath reference found.
 */
function detectNodeAlias(cypher: string): string {
  const returnIdx = cypher.lastIndexOf('RETURN');
  if (returnIdx === -1) return 'source';

  const returnClause = cypher.slice(returnIdx);

  // Match "alias.filePath" in the RETURN clause
  const match = returnClause.match(/(\w+)\.filePath/);
  if (match?.[1]) return match[1];

  // Match "alias.path" as a fallback
  const pathMatch = returnClause.match(/(\w+)\.path/);
  if (pathMatch?.[1]) return pathMatch[1];

  // Default to "source" (most common in our templates)
  return 'source';
}
