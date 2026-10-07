/**
 * C16 golden regression suite (FR-30, NFR-01, NFR-05).
 *
 * Runs the five fixture projects through the real symbolic pipeline against a
 * local Neo4j and compares the normalised result with the committed snapshot.
 *
 * Env:
 * - NEO4J_PASSWORD (required; this test never loads .env), NEO4J_URI, NEO4J_USER
 * - GOLDEN_REQUIRED=1  missing password is an error instead of a skip
 * - GOLDEN_ALLOW_WIPE=1  allow a non-local Neo4j host (ingestion wipes the database)
 * - UPDATE_GOLDEN=1  (re)write snapshot files; refused when CI is set
 * - CI (any value except '', '0', 'false')  a missing snapshot file fails the case
 * - GOLDEN_REQUIRED=1  a missing snapshot also fails once the baseline exists
 *   (the snapshot directory holds at least one .json file); before Step 8
 *   generates the baseline it only warns
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { GOLDEN_CASES, REPO_ROOT } from './golden-cases.js';
import { isCiEnv, redactSecrets, redactUri, resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';
import { runGoldenCase } from './golden-runner.js';
import { normaliseForSnapshot, serialiseSnapshot } from './normalise.js';

const SNAPSHOT_DIR = path.join(__dirname, '__snapshots__');
const CASE_TIMEOUT_MS = 120_000;

const goldenEnv = resolveGoldenEnv();
const isCI = isCiEnv();
const update = process.env['UPDATE_GOLDEN'] === '1';
const required = process.env['GOLDEN_REQUIRED'] === '1';

/** The baseline exists once the snapshot directory holds a .json file. */
function baselineExists(): boolean {
  try {
    return fs.readdirSync(SNAPSHOT_DIR).some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}

function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

function realpathOr(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

/** Machine-specific absolute paths that must never reach a snapshot. */
const FORBIDDEN_PATHS = [...new Set([
  REPO_ROOT,
  realpathOr(REPO_ROOT),
  os.tmpdir(),
  realpathOr(os.tmpdir()),
  os.homedir(),
  process.env['PWD'],
  process.env['INIT_CWD'],
].filter((p): p is string => p !== undefined && p.length > 1))];

if (!goldenEnv.enabled) {
  console.warn(`[golden] ${goldenEnv.reason}`);
}

const describeGolden = goldenEnv.enabled ? describe : describe.skip;

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

describeGolden('C16 golden regression suite (symbolic-only, specs/clean-arch.yaml)', () => {
  beforeAll(async () => {
    const neo4j = neo4jConfig();
    const repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), 10_000);
      });
      const healthy = await Promise.race([repo.healthCheck(), timeout]);
      if (!healthy) {
        throw new Error(`Neo4j at ${redactUri(neo4j.uri)} is not reachable or rejected the credentials (health check failed within 10 s).`);
      }
    } finally {
      if (timer) clearTimeout(timer);
      await repo.close();
    }
  }, 30_000);

  // Sequential on purpose: every case wipes and re-ingests the same database.
  for (const c of GOLDEN_CASES) {
    it(`${c.id} matches its golden snapshot`, async () => {
      const neo4j = neo4jConfig();
      const result = await runGoldenCase(c, neo4j);
      if (!result.success) {
        // Driver errors are not scrubbed at HEAD (D-U0-6 wires that in U2).
        const detail = result.errors
          .map((e) => redactSecrets(`${e.code}: ${e.message}`, neo4j.password))
          .join('\n');
        throw new Error(`Pipeline failed for ${c.id}:\n${detail}`);
      }
      expect(result.success).toBe(true);
      const run = result.data;

      // Violation ids are unique within the report.
      const ids = run.report.violations.map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);

      // NFR-05: the report never carries the password (boolean asserts, so a
      // failure never prints the secret).
      const reportJson = JSON.stringify(run.report);
      expect(reportJson.includes(neo4j.password)).toBe(false);
      expect(reportJson.includes(`neo4j:${neo4j.password}@`)).toBe(false);

      const snapshot = normaliseForSnapshot(c.id, run);
      const serialised = serialiseSnapshot(snapshot);
      expect(serialised.includes(neo4j.password)).toBe(false);

      // No machine-specific absolute path reaches the snapshot.
      const absolute = allStrings(JSON.parse(serialised)).filter((v) => v.startsWith('/'));
      expect(absolute).toEqual([]);
      expect(FORBIDDEN_PATHS.filter((p) => serialised.includes(p))).toEqual([]);

      if (snapshot.truncatedFunctions && snapshot.truncatedFunctions.length > 0) {
        // R2 cap fallback: an observation for tests/golden/CHANGES.md, not a failure.
        console.warn(
          `[golden] observation ${c.id}: no-cyclic-deps hit LIMIT 100 for ` +
          `${snapshot.truncatedFunctions.map((t) => t.functionId).join(', ')}; violations replaced by truncatedFunctions.`,
        );
      }

      const file = path.join(SNAPSHOT_DIR, `${c.id}.json`);

      if (update) {
        if (isCI) {
          throw new Error('UPDATE_GOLDEN=1 is refused when CI is set; regenerate snapshots locally (plan Step 8).');
        }
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
        fs.writeFileSync(file, serialised, 'utf8');
        return;
      }

      if (!fs.existsSync(file)) {
        if (isCI || (required && baselineExists())) {
          throw new Error(
            `Missing golden snapshot ${path.relative(process.cwd(), file)} ` +
            `(${isCI ? 'CI is set' : 'GOLDEN_REQUIRED=1 and the baseline exists'}).`,
          );
        }
        console.warn(
          `[golden] ${c.id}: no snapshot at ${path.relative(process.cwd(), file)}; comparison skipped ` +
          '(run with UPDATE_GOLDEN=1 to create it).',
        );
        return;
      }

      const expected = fs.readFileSync(file, 'utf8');
      expect(JSON.parse(serialised)).toEqual(JSON.parse(expected));
      expect(serialised).toBe(expected);
    }, CASE_TIMEOUT_MS);
  }
});
