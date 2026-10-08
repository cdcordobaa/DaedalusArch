/**
 * U5b Step 15: environment recorder and scrubbed artefacts (FR-03; NFR-05, 08; BR-U5b-69, 70). Fake runner only.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import { writeScrubbedJson } from '../../../../scripts/lib/report-io.js';
import { ENV_RECORD_FAILED, main, plainValue, recordEnvironment, validateEnvironmentRecord } from '../../../../scripts/record-env.js';
import { runPlan } from '../../../../scripts/run-experiment.js';
import type { ExperimentPlan } from '../../../../scripts/run-experiment.js';
import { ROOT } from './score-fixture.js';

const FAKE_KEY = `AIza${'Q'.repeat(35)}`;
const LANE_PW = 'lane-pw-zz55aa11';
const CRED_URI = `bolt://neo4j:${LANE_PW}@localhost:7692`;
const IMAGE_ID = `sha256:${'f'.repeat(64)}`;
const ENV: NodeJS.ProcessEnv = {
  PATH: '/usr/bin', HOME: '/home/x', NEO4J_USER: 'neo4j', NEO4J_PASSWORD: LANE_PW, GEMINI_API_KEY: FAKE_KEY,
  U5B_FAKE_ENV_KEY: 'u5b-fake-env-value', AWS_SECRET_ACCESS_KEY: 'aws-fake-secret-value',
};

class Fake implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];
  constructor(private readonly reply: (command: string, args: readonly string[]) => Partial<ProcessResult>) {}
  run(command: string, args: readonly string[], options: ProcessRunOptions): ReturnType<ProcessRunner['run']> {
    this.calls.push({ command, args, options });
    return Promise.resolve({ success: true, data: { exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 1, ...this.reply(command, args) } });
  }
}

function docker(extra: (args: readonly string[]) => Partial<ProcessResult> | undefined = () => undefined): Fake {
  return new Fake((command, args) => {
    const e = extra(args);
    if (e !== undefined) return e;
    if (command === 'git') return { stdout: `${'a'.repeat(40)}\n` };
    if (command === 'claude') return { stdout: '2.1.294 (Claude Code)\n' };
    if (args[0] === 'image') return { stdout: JSON.stringify({ Id: IMAGE_ID, RepoDigests: [`neo4j@${IMAGE_ID}`], Config: { Env: [`NEO4J_AUTH=neo4j/${LANE_PW}`] } }) };
    const q = args.at(-1) ?? '';
    if (q.includes('dbms.components')) return { stdout: 'versions[0] + " " + edition\n"5.26.24 community"\n' };
    if (q.includes('apoc.version')) return { stdout: 'apoc.version()\n"5.26.24"\n' };
    return { exitCode: 1, stderr: 'unexpected' };
  });
}

const HW = () => ({ cpu: 'Test CPU', cores: 8, memGb: 16, os: 'testos 1.0 arm64' });
const opts = (runner: ProcessRunner, over = {}) => ({ repoRoot: ROOT, runner, parentEnv: ENV, now: () => new Date('2026-10-08T12:00:00Z'), hardware: HW, ...over });

describe('environment recorder (BR-U5b-69)', () => {
  it('the record validates and holds no environment variable', async () => {
    const r = await recordEnvironment(opts(docker(), { neo4jContainer: 'daedalus-neo4j-u5b', judgeModelIds: ['claude-opus-5-5'] }));
    if (!r.ok) throw new Error(r.detail);
    expect(validateEnvironmentRecord(r.record, ROOT)).toEqual([]);
    expect(r.record).toMatchObject({
      gitCommit: 'a'.repeat(40), neo4jServer: '5.26.24 community', apoc: '5.26.24', claudeCli: '2.1.294 (Claude Code)',
      neo4jImage: { tag: 'neo4j:5.26-community@sha256:f66304b9511c60d33555a2c451f88e03d82d1ebc893f32d84c98a6b326096435', id: IMAGE_ID },
      judgeModelIds: ['claude-opus-5-5'], typescript: '5.9.3', geminiSdk: '0.24.1',
    });
    expect(r.record.id).toMatch(/^env-[0-9a-f]{12}$/);
    const text = JSON.stringify(r.record);
    for (const [k, v] of Object.entries(ENV)) {
      expect({ key: k, inText: text.includes(k) }).toEqual({ key: k, inText: false });
      expect({ key: k, valueInText: v !== undefined && v.length > 6 && text.includes(v) }).toEqual({ key: k, valueInText: false });
    }
  });

  it('cypher-shell gets the credentials as child variables only, never on the command line', async () => {
    const runner = docker();
    await recordEnvironment(opts(runner, { neo4jContainer: 'daedalus-neo4j-u5b' }));
    const cypher = runner.calls.filter((c) => c.args.includes('cypher-shell'));
    expect(cypher).toHaveLength(2);
    for (const c of cypher) {
      expect(c.args.slice(0, 6)).toEqual(['exec', '-e', 'NEO4J_USERNAME', '-e', 'NEO4J_PASSWORD', 'daedalus-neo4j-u5b']);
      expect(c.args.join(' ')).not.toContain(LANE_PW);
      expect(c.options.env.NEO4J_PASSWORD).toBe(LANE_PW);
    }
    for (const c of runner.calls.filter((x) => !x.args.includes('cypher-shell'))) expect(Object.keys(c.options.env)).not.toContain('NEO4J_PASSWORD');
    const compose = docker();
    await recordEnvironment(opts(compose));
    expect(compose.calls.find((c) => c.args.includes('cypher-shell'))?.args.slice(0, 3)).toEqual(['compose', 'exec', '-T']);
  });

  it('a failing subprocess refuses the record; --self-test exits 1', async () => {
    const r = await recordEnvironment(opts(docker((args) => (args[0] === 'image' ? { exitCode: 1, stderr: 'No such image' } : undefined))));
    expect(r).toMatchObject({ ok: false, code: ENV_RECORD_FAILED });
    const io = { out: () => undefined, err: () => undefined, writeFile: () => undefined };
    expect(await main(['--self-test'], ROOT, io, docker(), ENV)).toBe(1);
    expect(await main(['--bogus'], ROOT, io, docker(), ENV)).toBe(2);
    expect(plainValue('h\n"x y"\n')).toBe('x y');
  });
});

describe('scrubbed artefacts (BR-U5b-70)', () => {
  let dir = '';
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'u5b-scrub-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });
  const clean = (path: string): void => {
    const text = readFileSync(path, 'utf8');
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain(LANE_PW);
    expect(text).not.toContain(CRED_URI);
  };

  it('a cassette, a RunRecord and an EnvironmentRecord seeded with a fake key and a credentialed URI are written without either', async () => {
    // Cassette (the labeller and judge cassettes are written through the same helper).
    const cassette = join(dir, 'cassettes/label/item.json');
    writeScrubbedJson(cassette, { request: { prompt: `use ${FAKE_KEY}` }, response: { text: `connect ${CRED_URI}` } }, [LANE_PW, FAKE_KEY]);
    clean(cassette);
    expect(readFileSync(cassette, 'utf8')).toContain('[REDACTED]');

    // RunRecord: the transport-error detail carries both.
    const plan: ExperimentPlan = {
      id: 't', experiment: 'fixtures', mode: 'symbolic-only', seeds: { sampling: 1, bootstrap: 1, permutation: 1 },
      cassetteDir: 'experiments/t/cassettes', outDir: 'results/t', projects: [{ projectId: 'a', path: 'p/a', specPath: 'specs/clean-arch.yaml' }],
    };
    const runner = new Fake(() => ({ exitCode: 2, stderr: `refused ${CRED_URI} key=${FAKE_KEY}` }));
    const r = await runPlan(plan, 'experiments/t/plan.json', ROOT, {
      runner, cli: { command: 'cli', args: [] }, parentEnv: ENV, now: () => new Date('2026-10-08T12:00:00Z'), cliCommit: 'b'.repeat(40),
      gate: () => ({ ok: true, prereg: { version: 1, registeredAt: '2026-10-01T00:00:00Z', matchingRuleVersion: '1.0.0', artefacts: [], labellingBudgetCalls: 0, e1Grid: { models: 3, specLevels: 3, tasks: 2, runs: 3 } }, frozenHashes: {} }),
      recordEnvironment: async () => {
        const env = await recordEnvironment(opts(docker((args) => ((args.at(-1) ?? '').includes('apoc') ? { stdout: `apoc.version()\n"5.26.24 ${CRED_URI} ${FAKE_KEY}"\n` } : undefined))));
        if (!env.ok) throw new Error(env.detail);
        return { id: env.record.id, record: env.record };
      },
      outDir: dir,
    });
    expect(r.records[0]).toMatchObject({ status: 'rejected', reasonCode: 'transport-error' });
    const runFile = join(dir, 'runs', readdirSync(join(dir, 'runs'))[0] ?? '');
    clean(runFile);
    // EnvironmentRecord written by the harness.
    const envFile = join(dir, 'env', readdirSync(join(dir, 'env'))[0] ?? '');
    clean(envFile);
    expect(readFileSync(envFile, 'utf8')).toContain('[REDACTED]');
  });
});
