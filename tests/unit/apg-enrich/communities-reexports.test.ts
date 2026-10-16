/**
 * R14 (Docs/v1.3/post-merge-review-2026-10-16.md, the confirmed half): the communities proxy builds its file graph from
 * the literal edge view but keeps only IMPORTS|CONSTRUCTOR_INJECTS|CALLS, dropping the RE_EXPORTS edges the literal view
 * keeps (edge-views.md: literal = IMPORTS without viaReExport, plus RE_EXPORTS). A file reached only through a barrel
 * then has no link to its importers. The fix is opt-in (`communityReExports`), because it changes the committed cheap
 * proxy outputs; the default graph is unchanged.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { buildContext } from '../../../src/apg-enrich/cheap/context.js';
import { fileGraph } from '../../../src/apg-enrich/cheap/communities.js';
import { openProject } from '../../../src/apg-enrich/cheap/index.js';
import { DEFAULT_CHEAP_OPTIONS } from '../../../src/apg-enrich/cheap/types.js';

describe('R14: communities and barrel re-exports', () => {
  it('with communityReExports the declaring file behind a barrel is linked into the graph; the default is unchanged', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r14-')));
    const w = (rel: string, text: string): void => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    };
    w('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, module: 'commonjs', target: 'ES2022' }, include: ['src/**/*.ts'] }));
    w('src/billing/invoice.ts', 'export class Invoice {}\n');
    w('src/shared/index.ts', "export { Invoice } from '../billing/invoice';\n");
    w('src/orders/order.service.ts', "import { Invoice } from '../shared';\nexport class OrderService { make(): Invoice { return new Invoice(); } }\n");
    try {
      const r = await extractAPG(root, {}, path.join(root, 'tsconfig.json'));
      if (!r.success) throw new Error('extract failed');
      const input = { apg: r.data, project: openProject(path.join(root, 'tsconfig.json')), projectRoot: root };
      const touches = (opts: typeof DEFAULT_CHEAP_OPTIONS, file: string): boolean =>
        fileGraph(buildContext(input, opts)).edges.some((e) => e.a.endsWith(file) || e.b.endsWith(file));
      expect(touches(DEFAULT_CHEAP_OPTIONS, 'billing/invoice.ts')).toBe(false); // the defect, kept by default
      expect(touches({ ...DEFAULT_CHEAP_OPTIONS, communityReExports: true }, 'billing/invoice.ts')).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
