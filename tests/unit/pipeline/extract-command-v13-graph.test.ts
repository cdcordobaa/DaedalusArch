/**
 * The graph `firewall evaluate` reads (`ExtractCommand`, unmocked) is the v1.3 default extraction, not the frozen
 * v1.2E one: an import through a barrel gives the literal edge (`reExportHop`) and the resolved edge (`viaReExport`),
 * and a `require()` call is an IMPORTS edge (`dynamic`). Diagnostic context:
 * `Docs/DiagnosticRuns/v1.3-default-view-coverage-2026-10-16.md` (the 0.926 / 0.904 figure of the external set
 * measures `V12E_DEFAULT_OPTIONS`, which `evaluate` does not use).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/index.js';
import { ExtractCommand } from '../../../src/pipeline/commands/extract-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { APGResult } from '../../../src/shared/types/apg.js';

const FILES: Record<string, string> = {
  'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, module: 'commonjs', moduleResolution: 'node' }, include: ['src/**/*.ts'] }),
  'src/domain/order.ts': 'export class Order {}\n',
  'src/domain/index.ts': "export * from './order';\n",
  'src/app/use.ts': "import { Order } from '../domain';\nexport const o = new Order();\n",
  'src/app/boot.ts': "declare const require: (m: string) => unknown;\nexport const u = require('./use');\n",
};

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-v13-'));
  for (const [f, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function imports(apg: APGResult): string[] {
  const file = new Map(apg.nodes.map((n) => [n.id, n.filePath]));
  return apg.edges.filter((e) => e.type === 'IMPORTS').map((e) => {
    const p = e.properties;
    const marks = ['reExportHop', 'viaReExport', 'dynamic'].filter((k) => p[k] === true);
    return `${file.get(e.sourceId) ?? '?'} -> ${file.get(e.targetId) ?? '?'}${marks.length > 0 ? ` [${marks.join(',')}]` : ''}`;
  }).sort();
}

describe('ExtractCommand builds the v1.3 default graph', () => {
  it('literal + resolved barrel edges and the require() edge, same as extractAPG with V13_DEFAULT_OPTIONS', async () => {
    const context = new FirewallContext(runId('extract-v13'));
    const result = await new ExtractCommand(dir).execute(context);
    expect(result.success).toBe(true);
    const apg = context.getApgResult();
    const viaCommand = imports(apg);
    expect(viaCommand).toEqual([
      'src/app/boot.ts -> src/app/use.ts [dynamic]',
      'src/app/use.ts -> src/domain/index.ts [reExportHop]',
      'src/app/use.ts -> src/domain/order.ts [viaReExport]',
    ]);
    const direct = await extractAPG(dir, { ...V13_DEFAULT_OPTIONS, excludePatterns: [] });
    expect(direct.success).toBe(true);
    if (direct.success) expect(viaCommand).toEqual(imports(direct.data));
  });
});
