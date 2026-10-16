import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { renameFindingPath, renameGlob, renamePath, renameProject, rewriteSpecifiers } from '../../../../scripts/v1.3/lib/ise-rename.js';

const map = { 'src/domain': 'src/kernel', 'src/adapters/inbound': 'src/plugins/entry' };

describe('ISE rename probe helpers', () => {
  it('renames paths, globs (also segment-wise under a wildcard) and cycle paths', () => {
    expect(renamePath('src/domain/a.ts', map)).toBe('src/kernel/a.ts');
    expect(renamePath('src/domainx/a.ts', map)).toBe('src/domainx/a.ts');
    expect(renamePath('src/adapters/inbound/http/C.ts', map)).toBe('src/plugins/entry/http/C.ts');
    expect(renameGlob('src/domain/**', map)).toBe('src/kernel/**');
    const ctx = { 'src/ordering/domain': 'src/ordering/kernel', 'src/billing/domain': 'src/billing/kernel' };
    expect(renameGlob('src/*/domain/**', ctx)).toBe('src/*/kernel/**');
    expect(renameGlob('src/*/infrastructure/**', ctx)).toBe('src/*/infrastructure/**');
    expect(renameFindingPath('src/domain/a.ts,src/domain/b.ts', map)).toBe('src/kernel/a.ts,src/kernel/b.ts');
  });

  it('rewrites relative specifiers from the renamed location, leaving packages alone', () => {
    const src = "import { A } from '../domain/A';\nimport x from 'express';\nexport * from './B';\nconst m = require('../domain/M');\n";
    expect(rewriteSpecifiers(src, 'src/app/X.ts', map)).toBe("import { A } from '../kernel/A';\nimport x from 'express';\nexport * from './B';\nconst m = require('../kernel/M');\n");
    expect(rewriteSpecifiers("import { C } from '../../../domain/C';", 'src/adapters/inbound/http/X.ts', map)).toBe("import { C } from '../../../kernel/C';");
  });

  it('moves the directories of a project copy and keeps its imports resolvable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-rename-'));
    try {
      fs.mkdirSync(path.join(dir, 'src/domain'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'src/app'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src/domain/A.ts'), 'export class A {}\n');
      fs.writeFileSync(path.join(dir, 'src/app/U.ts'), "import { A } from '../domain/A';\n");
      renameProject(dir, { 'src/domain': 'src/kernel' });
      expect(fs.existsSync(path.join(dir, 'src/kernel/A.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'src/domain'))).toBe(false);
      expect(fs.readFileSync(path.join(dir, 'src/app/U.ts'), 'utf8')).toBe("import { A } from '../kernel/A';\n");
      expect(() => { renameProject(dir, { 'src/nope': 'src/x' }); }).toThrow(/does not exist/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
