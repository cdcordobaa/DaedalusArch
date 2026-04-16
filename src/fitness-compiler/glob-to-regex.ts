/**
 * Convert a glob pattern to a Neo4j-compatible regex string.
 * Supported: * (single level), ** (recursive), ? (single char), literal paths.
 * Patterns are anchored (^...$) for full-path matching.
 */
export function globToRegex(pattern: string): string {
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
        result += '.*';
        i += 2;
        // Skip trailing slash after ** (e.g., **/ → .*)
        if (pattern[i] === '/') i++;
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
