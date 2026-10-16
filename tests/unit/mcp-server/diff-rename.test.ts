/**
 * R07 (Docs/v1.3/post-merge-review-2026-10-16.md): a 100%-similarity rename in `git diff` output has no ---/+++ lines
 * and no hunks. check_diff must still see the move and check the moved file in its new layer.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkDiff, parseUnifiedDiffWithHunks } from '../../../src/mcp-server/diff-check.js';
import { CLEAN_ARCH_SPEC, loadSpec } from './helpers.js';

const REPO_TEXT = "import { Repository } from 'typeorm';\n\nexport class TypeOrmOrderRepository {\n  constructor(private readonly repo: Repository<unknown>) {}\n}\n";

const PURE_RENAME = [
  'diff --git a/src/infrastructure/TypeOrmOrderRepository.ts b/src/domain/TypeOrmOrderRepository.ts',
  'similarity index 100%',
  'rename from src/infrastructure/TypeOrmOrderRepository.ts',
  'rename to src/domain/TypeOrmOrderRepository.ts',
];
const OTHER_EDIT = [
  'diff --git a/src/application/Other.ts b/src/application/Other.ts',
  'index 1111111..2222222 100644',
  '--- a/src/application/Other.ts',
  '+++ b/src/application/Other.ts',
  '@@ -1 +1,2 @@',
  ' export const a = 1;',
  '+export const b = 2;',
];

function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'diff-rename-')));
  fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'application'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'domain', 'TypeOrmOrderRepository.ts'), REPO_TEXT);
  fs.writeFileSync(path.join(root, 'src', 'application', 'Other.ts'), 'export const a = 1;\nexport const b = 2;\n');
  return root;
}

describe('R07: check_diff and renames without ---/+++ lines', () => {
  it('the parser keeps a pure rename as a renamed entry with no hunks, beside the other files', () => {
    const files = parseUnifiedDiffWithHunks([...PURE_RENAME, ...OTHER_EDIT].join('\n'));
    expect(files.map((f) => [f.oldPath, f.newPath, f.hunks.length])).toEqual([
      ['src/infrastructure/TypeOrmOrderRepository.ts', 'src/domain/TypeOrmOrderRepository.ts', 0],
      ['src/application/Other.ts', 'src/application/Other.ts', 1],
    ]);
  });

  it('moving an ORM repository into the domain blocks (the moved file is checked whole in its new layer)', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const root = project();
    try {
      for (const diff of [[...PURE_RENAME, ...OTHER_EDIT], [...OTHER_EDIT, ...PURE_RENAME], PURE_RENAME]) {
        const res = checkDiff(spec, `${diff.join('\n')}\n`, { projectRoot: root });
        const moved = res.files.find((f) => f.path === 'src/domain/TypeOrmOrderRepository.ts');
        expect(moved?.change).toBe('renamed');
        expect(moved?.blockingVerdict).toBe('block');
        expect(res.blockingVerdict).toBe('block');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('without a project root a pure rename across layers is unknown, not pass', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const res = checkDiff(spec, `${PURE_RENAME.join('\n')}\n`);
    expect(res.files[0]?.change).toBe('renamed');
    expect(res.blockingVerdict).toBe('unknown');
    expect(res.files[0]?.notes.join(' ')).toMatch(/moved from infrastructure to domain/);
  });
});
