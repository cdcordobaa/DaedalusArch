/**
 * R22 (Docs/v1.3/post-merge-review-2026-10-16.md): `git diff` run in a monorepo prints paths relative to the git
 * top level (`b/packages/app/src/...`), while the spec's layer globs are project-relative. With the server's project
 * at /repo/packages/app, check_diff must map such paths onto the project, not pass them as no-layer files.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkDiff } from '../../../src/mcp-server/diff-check.js';
import { CLEAN_ARCH_SPEC, loadSpec } from './helpers.js';

const NEW_FILE = [
  'diff --git a/packages/app/src/domain/Order.ts b/packages/app/src/domain/Order.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/packages/app/src/domain/Order.ts',
  '@@ -0,0 +1,2 @@',
  "+import { Entity } from 'typeorm';",
  '+export class Order {}',
].join('\n');

describe('R22: check_diff with git-root-relative paths', () => {
  it('maps packages/app/src/... onto a project rooted at packages/app and blocks the ORM import in the domain', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mono-')));
    const app = path.join(repo, 'packages', 'app');
    fs.mkdirSync(path.join(app, 'src', 'domain'), { recursive: true });
    fs.writeFileSync(path.join(app, 'src', 'domain', 'Order.ts'), "import { Entity } from 'typeorm';\nexport class Order {}\n");
    try {
      const res = checkDiff(spec, `${NEW_FILE}\n`, { projectRoot: app });
      expect(res.files.map((f) => [f.path, f.layer])).toEqual([['src/domain/Order.ts', 'domain']]);
      expect(res.blockingVerdict).toBe('block');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('leaves a project-relative diff unchanged', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const res = checkDiff(spec, `${NEW_FILE.replace(/packages\/app\//g, '')}\n`);
    expect(res.files.map((f) => [f.path, f.layer])).toEqual([['src/domain/Order.ts', 'domain']]);
  });
});
