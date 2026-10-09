/**
 * The spec's extraction excludes, one rule for the pipeline and the SO2 measurement script
 * (ADR-021 SO2; audit SO2-3, SO2-4, X-4). Hand-written YAML fixtures.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSpecExcludePaths, specExcludePathsFromYaml } from '../../../src/spec-parser/index.js';

describe('specExcludePathsFromYaml', () => {
  it('returns default_exclude_paths in file order, as strings', () => {
    expect(specExcludePathsFromYaml('name: x\ndefault_exclude_paths:\n  - "test/**"\n  - "src/generated/**"\n  - 42\n'))
      .toEqual(['test/**', 'src/generated/**', '42']);
  });
  it('is empty when the key is absent, not a list, or the document is empty or a scalar', () => {
    expect(specExcludePathsFromYaml('name: x\n')).toEqual([]);
    expect(specExcludePathsFromYaml('default_exclude_paths: "test/**"\n')).toEqual([]);
    expect(specExcludePathsFromYaml('')).toEqual([]);
    expect(specExcludePathsFromYaml('just a string')).toEqual([]);
  });
  it('throws on YAML that does not parse', () => {
    expect(() => specExcludePathsFromYaml('a: [unclosed\n')).toThrow();
  });
});

describe('readSpecExcludePaths', () => {
  it('reads the file; throws when it is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-excl-'));
    try {
      const f = join(dir, 's.yaml');
      writeFileSync(f, 'default_exclude_paths:\n  - "src/database/migrations/**"\n');
      expect(readSpecExcludePaths(f)).toEqual(['src/database/migrations/**']);
      expect(() => readSpecExcludePaths(join(dir, 'missing.yaml'))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('the registered dry-run-test spec lists its migrations exclude (the pipeline and SO2 read the same list)', () => {
    expect(readSpecExcludePaths(join(__dirname, '../../../corpus/specs/dry-run-test.yaml'))).toContain('src/database/migrations/**');
  });
});
