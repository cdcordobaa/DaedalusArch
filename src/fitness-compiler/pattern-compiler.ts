import { globToRegex } from './glob-to-regex.js';

/**
 * Compile an FR-07 `pattern` (BR-U1-06 grammar: glob alternatives separated by `|`) to one anchored regex,
 * matched against a class name: split on `|`, `globToRegex` per alternative with its `^`/`$` anchors
 * stripped, joined as `^(?:a1|a2|…)$`.
 */
export function compilePattern(pattern: string): string {
  const alternatives = pattern.split('|').map((alt) => globToRegex(alt).slice(1, -1));
  return `^(?:${alternatives.join('|')})$`;
}
