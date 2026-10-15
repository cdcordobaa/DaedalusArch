import * as fs from 'node:fs';
import * as path from 'node:path';
import { CHEAP2_FIXTURES, check, loadExpected, materialiseFixture, replayGit, runDir } from './batch2-helpers.js';
import type { ReplayCommit } from './batch2-helpers.js';

const HISTORY = JSON.parse(fs.readFileSync(path.join(CHEAP2_FIXTURES, 'co-change', 'history.json'), 'utf8')) as { commits: ReplayCommit[] };

describe('co-change proxy (batch 2)', () => {
  it('flags every planted hidden coupling and nothing on its near misses', async () => {
    const root = materialiseFixture('co-change');
    replayGit(root, HISTORY.commits);
    const fx = await runDir(root, ['co-change'], { coChangeMaxFilesPerCommit: 6 });
    try {
      expect(check(fx.flags('co-change'), loadExpected('co-change'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
      const s = fx.enrichment.summaries['co-change'] as { commits: number; commitsUsed: number; commitsDroppedLarge: number; matrix: Record<string, Record<string, { commits: number }>> };
      expect(s).toEqual(expect.objectContaining({ commits: 33, commitsDroppedLarge: 4, commitsUsed: 29 }));
      expect(s.matrix.billing?.shipping?.commits).toBe(4);
      const pair = fx.enrichment.edges.find((e) => e.type === 'CO_CHANGES_WITH' && e.evidence[0]?.file === 'src/metrics/meter.ts' && e.evidence[1]?.file === 'src/reports/report.ts');
      expect(pair?.properties).toEqual(expect.objectContaining({ support: 3, confidence: 0.375, reverseConfidence: 0.375, crossComponent: true }));
    } finally {
      fx.cleanup();
    }
  });

  it('skips cleanly without a git history', async () => {
    const root = materialiseFixture('co-change');
    fs.mkdirSync(path.join(root, 'src', 'a'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a', 'a.ts'), 'export const a = 1;\n');
    const fx = await runDir(root, ['co-change']);
    try {
      expect(fx.flags('co-change')).toEqual([]);
      expect(fx.enrichment.edges).toEqual([]);
      expect(fx.enrichment.summaries['co-change']).toEqual({ skipped: 'no .git at the project root' });
    } finally {
      fx.cleanup();
    }
  });
});
