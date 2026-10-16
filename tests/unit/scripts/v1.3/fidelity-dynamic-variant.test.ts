/**
 * R11 (Docs/v1.3/post-merge-review-2026-10-16.md): graph-fidelity's 'apg-v13-dynamicImports' variant must isolate the
 * dynamicImports option: the v1.2E options plus dynamicImports, not `{ dynamicImports: true }` over this branch's v1.3
 * defaults (which also turn on both re-export views, module wiring, member facts and alias packages).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG, V12E_DEFAULT_OPTIONS } from '../../../../src/apg-extractor/index.js';
import { DYNAMIC_IMPORTS_VARIANT_OPTIONS } from '../../../../scripts/v1.3/lib/fidelity-variants.js';

describe('R11: the dynamicImports fidelity variant', () => {
  it('is the v1.2E options with dynamicImports on, and nothing else', () => {
    expect({ ...DYNAMIC_IMPORTS_VARIANT_OPTIONS, dynamicImports: false }).toEqual({ ...V12E_DEFAULT_OPTIONS });
    expect(DYNAMIC_IMPORTS_VARIANT_OPTIONS.dynamicImports).toBe(true);
  });

  it('on a barrel project it adds the import() edge but no literal/resolved double edges', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r11-')));
    const w = (rel: string, text: string): void => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    };
    w('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, module: 'commonjs', target: 'ES2022' }, include: ['src/**/*.ts'] }));
    w('src/d/x.ts', 'export class X {}\n');
    w('src/d/index.ts', "export { X } from './x';\n");
    w('src/a.ts', "import { X } from './d';\nexport const x = X;\nexport const later = (): Promise<unknown> => import('./b');\n");
    w('src/b.ts', 'export const b = 1;\n');
    try {
      const r = await extractAPG(root, DYNAMIC_IMPORTS_VARIANT_OPTIONS);
      if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
      const imports = r.data.edges.filter((e) => e.type === 'IMPORTS');
      expect(imports.some((e) => e.properties.viaReExport === true || e.properties.reExportHop === true)).toBe(false);
      expect(imports.some((e) => e.properties.dynamic === true)).toBe(true);
      const naive = await extractAPG(root, { dynamicImports: true });
      if (!naive.success) throw new Error('extract failed');
      // The defect: over the v1.3 defaults the same option also yields the resolved re-export edges.
      expect(naive.data.edges.some((e) => e.type === 'IMPORTS' && e.properties.viaReExport === true)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
