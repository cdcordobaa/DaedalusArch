/**
 * Full-mode golden lane L0 (FR-30, U4 Q16 A; BR-U4-CAS-10, CAS-11; Build and Test Step 46).
 * Same skip and host guards as the rest of the golden suite (golden-env.ts); run by
 * `npm run test:golden:full` (its own CI step), not by `npm run test:golden`.
 *
 * Per golden fixture: full mode, Mock provider, replay of the committed cassettes
 * (`tests/fixtures/judge-cassettes/<case>/`) with `PATH` emptied, from a temp copy. Asserted: zero
 * misses (a miss fails with `re-record: <n> missing keys`), the Mock never called, one result per
 * selected unit with nothing capped, replay equal to a fresh scripted Mock record, and the committed
 * directory unchanged. The snapshot comparison against `tests/golden/__snapshots_full__/` starts with
 * the L0 baseline commit (held by E-2); see `full-lane.ts`.
 *
 * `BT_RECORD_FULL_LANE_CASSETTES=1` registers the recorder for variant-a..d (zero live calls; the
 * correct-reference set stays U4's D-U4-12 recording). `UPDATE_GOLDEN=1` writes the lane snapshots
 * (refused under CI) — only in the L0 baseline commit, after the rubric freeze.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { listCassetteKeys } from '../../src/llm-critic/cassette-manager.js';
import { GOLDEN_CASES } from './golden-cases.js';
import type { GoldenCase } from './golden-cases.js';
import { isCiEnv, resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';
import {
  FULL_SNAPSHOT_DIR, copyCassettes, fullBaselineExists, fullLaneSnapshot, laneCassetteDir, missingKeyCount,
  readRunManifests, reRecordMessage, replayLane, runFullMode, scriptMock,
} from './full-lane.js';

const goldenEnv = resolveGoldenEnv();
if (!goldenEnv.enabled) {
  console.warn(`[full-lane] ${goldenEnv.reason}`);
}
const describeLane = goldenEnv.enabled ? describe : describe.skip;
const RECORD = process.env.BT_RECORD_FULL_LANE_CASSETTES === '1';
const update = process.env.UPDATE_GOLDEN === '1';
const required = process.env.GOLDEN_REQUIRED === '1';
const CASE_TIMEOUT_MS = 180_000;
const REQUESTED_MODEL = 'claude-opus-5-5';

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

/** Every file of a directory, sorted, as one string (byte-level unchanged check). */
function allFilesText(dir: string): string {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(`${path.relative(dir, p)}\n${fs.readFileSync(p, 'utf8')}`);
    }
  };
  walk(dir);
  return out.join('\n');
}

function neuralOf(report: { neuralResults?: unknown }): string {
  return JSON.stringify(report.neuralResults ?? []);
}

describeLane('full-mode golden lane L0 (FR-30; BR-U4-CAS-10, CAS-11)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  if (RECORD) {
    it.each(GOLDEN_CASES.filter((c) => c.id !== 'correct-reference').map((c) => [c.id, c] as const))(
      'recorder: writes %s Mock fixture cassettes (BT_RECORD_FULL_LANE_CASSETTES=1)',
      async (_id, c: GoldenCase) => {
        const dir = laneCassetteDir(c.id);
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        const spy = scriptMock();
        const run = await runFullMode(c, neo4jConfig(), ['--llm-provider', 'mock', '--cassette-mode', 'record', '--cassette-dir', dir]);
        if (!run.ok) throw new Error(`recorder failed for ${c.id}: ${run.errors.map((e) => e.code).join(', ')}`);
        expect(listCassetteKeys(dir).length).toBe(spy.mock.calls.length);
      },
      CASE_TIMEOUT_MS,
    );
  }

  it.each(GOLDEN_CASES.map((c) => [c.id, c] as const))(
    '%s: Mock replay with PATH emptied, zero misses, equal to a fresh scripted record',
    async (_id, c: GoldenCase) => {
      const neo4j = neo4jConfig();
      const committed = laneCassetteDir(c.id);
      expect(listCassetteKeys(committed).length).toBeGreaterThan(0);
      const before = allFilesText(committed);

      const replaySpy = scriptMock();
      const report = await replayLane(c, neo4j, committed);
      expect(replaySpy).not.toHaveBeenCalled();
      jest.restoreAllMocks();
      expect(report.judge.cassetteMode).toBe('replay');
      expect(JSON.stringify(report).includes('CASSETTE_MISS')).toBe(false);
      expect(JSON.stringify(report).includes(neo4j.password)).toBe(false);
      for (const r of report.neuralResults ?? []) {
        const ids = r.unitResults.map((u) => u.unitId);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBe(r.unitsSelected);
        expect(r.unitsCapped).toBe(0);
      }

      scriptMock();
      const freshDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `full-lane-fresh-${c.id}-`)));
      try {
        const fresh = await runFullMode(c, neo4j, ['--llm-provider', 'mock', '--cassette-mode', 'record', '--cassette-dir', freshDir]);
        if (!fresh.ok) throw new Error(`fresh record failed for ${c.id}: ${fresh.errors.map((e) => e.code).join(', ')}`);
        expect(neuralOf(report)).toBe(neuralOf(fresh.report));
      } finally {
        fs.rmSync(freshDir, { recursive: true, force: true });
      }
      expect(allFilesText(committed)).toBe(before);

      const serialised = fullLaneSnapshot(c.id, report);
      expect(serialised.includes(neo4j.password)).toBe(false);
      expect(serialised.includes(os.homedir())).toBe(false);
      const file = path.join(FULL_SNAPSHOT_DIR, `${c.id}.json`);
      if (update) {
        if (isCiEnv()) throw new Error('UPDATE_GOLDEN=1 is refused when CI is set; the L0 baseline is written locally.');
        fs.mkdirSync(FULL_SNAPSHOT_DIR, { recursive: true });
        fs.writeFileSync(file, serialised, 'utf8');
        return;
      }
      if (!fs.existsSync(file)) {
        if (fullBaselineExists() && (isCiEnv() || required)) {
          throw new Error(`Missing full-mode lane snapshot ${path.relative(process.cwd(), file)} (the L0 baseline exists).`);
        }
        console.warn(`[full-lane] ${c.id}: L0 baseline pending (E-2: rubric freeze before the first measured full-mode run); comparison not made.`);
        return;
      }
      expect(serialised).toBe(fs.readFileSync(file, 'utf8'));
    },
    CASE_TIMEOUT_MS,
  );

  it('CAS-11: a replay miss fails with "re-record: <n> missing keys"', async () => {
    const c = GOLDEN_CASES.find((g) => g.id === 'correct-reference');
    if (!c) throw new Error('correct-reference case missing');
    const dir = copyCassettes(laneCassetteDir(c.id), 'full-lane-cas11-');
    try {
      const keys = listCassetteKeys(dir);
      const victim = keys[keys.length - 1] ?? '';
      fs.rmSync(path.join(dir, victim.slice(0, 2), `${victim}.json`));
      scriptMock();
      await expect(replayLane(c, neo4jConfig(), dir)).rejects.toThrow(reRecordMessage(1));
      // the helper reads the manifest of an incomplete replay the same way
      const run = await runFullMode(c, neo4jConfig(), ['--llm-provider', 'mock', '--cassette-mode', 'replay', '--cassette-dir', dir], { emptyPath: true });
      expect(run.ok).toBe(false);
      expect(missingKeyCount(readRunManifests(dir), dir)).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect(reRecordMessage(30)).toBe('re-record: 30 missing keys');
  }, CASE_TIMEOUT_MS);

  it('provenance: a replayed Mock record reports the requested model (U4 Step 28 deviation 3)', async () => {
    const c = GOLDEN_CASES.find((g) => g.id === 'correct-reference');
    if (!c) throw new Error('correct-reference case missing');
    scriptMock();
    const report = await replayLane(c, neo4jConfig(), laneCassetteDir(c.id));
    expect(report.judge.model).toBe(REQUESTED_MODEL);
  }, CASE_TIMEOUT_MS);
});
