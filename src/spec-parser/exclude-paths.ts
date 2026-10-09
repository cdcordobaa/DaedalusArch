import * as fs from 'node:fs';
import YAML from 'yaml';

/**
 * The spec's `default_exclude_paths` (extraction excludes) from its YAML text, as strings, in file order;
 * `[]` when the key is absent or not a list. Pure. Throws on YAML that does not parse.
 *
 * One rule for every caller that extracts the graph a spec evaluates: the pipeline (`pipeline-factory`,
 * passed to `ExtractCommand`) and the U6 SO2 measurement script (`scripts/so2-metrics.ts`; audit SO2-3,
 * SO2-4, X-4: the measured graph must be the evaluated one).
 */
export function specExcludePathsFromYaml(yamlText: string): string[] {
  const parsed = YAML.parse(yamlText) as unknown;
  if (parsed === null || typeof parsed !== 'object') return [];
  const raw = (parsed as { default_exclude_paths?: unknown }).default_exclude_paths;
  return Array.isArray(raw) ? raw.map(String) : [];
}

/** `specExcludePathsFromYaml` of the spec file at `specFilePath`. Throws when the file is unreadable. */
export function readSpecExcludePaths(specFilePath: string): string[] {
  return specExcludePathsFromYaml(fs.readFileSync(specFilePath, 'utf-8'));
}
