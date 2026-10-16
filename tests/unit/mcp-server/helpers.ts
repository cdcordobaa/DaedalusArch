import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';

export const REPO = path.resolve(__dirname, '../../..');
export const CLEAN_ARCH_SPEC = path.join(REPO, 'specs/clean-arch.yaml');
export const LAYERED_SPEC = path.join(REPO, 'tests/fixtures/u5a/layered/firewall.spec.yaml');
export const NO_DOMAIN_SPEC = path.join(REPO, 'tests/fixtures/u5a/no-domain/firewall.spec.yaml');
export const FIXTURES = path.join(REPO, 'fixtures');

export async function loadSpec(specPath: string): Promise<ParsedSpec> {
  const result = await parseSpec({ specFilePath: specPath });
  if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
  return result.data;
}

export interface SourceImport {
  readonly file: string;
  readonly specifier: string;
}

/** Every static `import ... from '<spec>'` of the `.ts` files under `<project>/src`, files project-relative. */
export function importsOf(project: string): readonly SourceImport[] {
  const out: SourceImport[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) {
        const text = fs.readFileSync(full, 'utf-8');
        for (const m of text.matchAll(
          /^\s*(?:import|export)\b[^'"\n]*?from\s+['"]([^'"]+)['"]/gm,
        )) {
          out.push({
            file: path.relative(project, full).split(path.sep).join('/'),
            specifier: m[1] ?? '',
          });
        }
      }
    }
  };
  walk(path.join(project, 'src'));
  return out;
}
