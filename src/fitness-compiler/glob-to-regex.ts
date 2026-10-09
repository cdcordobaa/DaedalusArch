/**
 * Convert a glob pattern to a Neo4j-compatible regex string.
 * Supported: * (single level), ** (recursive), ? (single char), literal paths.
 * Patterns are anchored (^...$) for full-path matching.
 *
 * By default `**\/` becomes `.*` (the slash is dropped), so `**\/main.ts` also matches `src/domain.ts`; existing
 * spec excludes and layer globs keep that behaviour. With `segmentGlobstar` (instrument v2 role exemptions,
 * ADR-026) a leading `**` plus slash matches zero or more whole directories (an optional group ending in a slash).
 */
export function globToRegex(pattern: string, options: { readonly segmentGlobstar?: boolean } = {}): string {
  if (pattern.length === 0) {
    throw new Error('Empty glob pattern');
  }

  let result = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i]!;

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** → match anything including path separators
        i += 2;
        if (options.segmentGlobstar === true && pattern[i] === '/') {
          result += '(?:.*/)?';
          i++;
        } else {
          result += '.*';
          // Skip trailing slash after ** (e.g., **/ → .*)
          if (pattern[i] === '/') i++;
        }
      } else {
        // * → match anything except path separator
        result += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      result += '.';
      i++;
    } else if ('.+^${}()|[]\\'.includes(char)) {
      // Escape regex special characters
      result += '\\' + char;
      i++;
    } else {
      result += char;
      i++;
    }
  }

  return '^' + result + '$';
}
