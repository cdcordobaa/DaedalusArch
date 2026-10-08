/**
 * Environment recorder (FR-03, R-6.2; NFR-05, NFR-08; BR-U5b-69, 70; U5b domain-entities §9).
 *
 * `recordEnvironment` builds one `EnvironmentRecord` per plan run:
 * - package versions from the tracked `package-lock.json` (typescript, ts-morph, neo4j-driver, jest, the Gemini SDK);
 * - the Neo4j image tag from `docker-compose.yml`, its id and repo digests from `docker image inspect`;
 * - the Neo4j server and APOC versions read by subprocess through `cypher-shell` (`CALL dbms.components()`,
 *   `RETURN apoc.version()`), inside the compose `neo4j` service (`docker compose exec -T neo4j`) or a named lane
 *   container (`docker exec`). Credentials reach `cypher-shell` only as the child's `NEO4J_USERNAME` /
 *   `NEO4J_PASSWORD` variables (`-e NAME` without a value), never on a command line;
 * - `git rev-parse HEAD`, the optional `claude --version`, the `Docs/environment.md` sha256 and the hardware.
 * No field holds an environment variable. The record is validated against
 * `scripts/lib/schemas/environment-record.schema.json` and scrubbed with the known secrets before it is returned.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { join, resolve } from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { ProcessRunner } from '../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import { canonicalize } from './lib/canonical-json.js';
import { knownSecretsOf, scrubbedJson } from './lib/report-io.js';

export const ENV_SCHEMA = 'scripts/lib/schemas/environment-record.schema.json';
export const ENVIRONMENT_DOC = 'Docs/environment.md';
export const ENV_RECORD_FAILED = 'ENV_RECORD_FAILED';
const SUBPROCESS_TIMEOUT_MS = 60_000;

export interface EnvironmentRecord {
  readonly id: string; readonly recordedAt: string; readonly gitCommit: string;
  readonly node: string; readonly typescript: string; readonly tsMorph: string; readonly neo4jDriver: string; readonly jest: string;
  readonly neo4jImage: { readonly tag: string; readonly id: string; readonly repoDigests: readonly string[] };
  readonly neo4jServer: string; readonly apoc: string;
  readonly geminiSdk: string; readonly claudeCli?: string;
  readonly labellerModelId?: string; readonly judgeModelIds: readonly string[]; readonly generatorModelIds: readonly string[];
  readonly environmentDocSha256: string;
  readonly hardware: { readonly cpu: string; readonly cores: number; readonly memGb: number; readonly os: string };
}

export interface RecordEnvOptions {
  readonly repoRoot: string;
  readonly runner: ProcessRunner;
  readonly parentEnv: NodeJS.ProcessEnv;
  readonly now: () => Date;
  /** A named lane container (`docker exec`); absent → the compose `neo4j` service. */
  readonly neo4jContainer?: string;
  readonly labellerModelId?: string;
  readonly judgeModelIds?: readonly string[];
  readonly generatorModelIds?: readonly string[];
  /** Hardware probe (tests inject a fixed value). */
  readonly hardware?: () => EnvironmentRecord['hardware'];
}

export type EnvOutcome =
  | { readonly ok: true; readonly record: EnvironmentRecord }
  | { readonly ok: false; readonly code: typeof ENV_RECORD_FAILED; readonly detail: string };

const validators = new Map<string, ValidateFunction>();

export function validateEnvironmentRecord(value: unknown, schemaRoot: string): string[] {
  const key = resolve(schemaRoot, ENV_SCHEMA);
  let v = validators.get(key);
  if (v === undefined) {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    v = ajv.compile(JSON.parse(readFileSync(key, 'utf8')) as Record<string, unknown>);
    validators.set(key, v);
  }
  return v(value) ? [] : (v.errors ?? []).map((e) => `${e.instancePath === '' ? '/' : e.instancePath} ${e.message ?? 'invalid'}`);
}

/** Resolved versions from the tracked lock file (never the `package.json` ranges). */
export function lockVersions(repoRoot: string): Record<'typescript' | 'tsMorph' | 'neo4jDriver' | 'jest' | 'geminiSdk', string> {
  const lock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as { packages?: Record<string, { version?: string }> };
  const v = (name: string): string => lock.packages?.[`node_modules/${name}`]?.version ?? 'absent';
  return { typescript: v('typescript'), tsMorph: v('ts-morph'), neo4jDriver: v('neo4j-driver'), jest: v('jest'), geminiSdk: v('@google/generative-ai') };
}

/** The `neo4j` service image of `docker-compose.yml`. */
export function composeNeo4jImage(repoRoot: string): string | undefined {
  const text = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
  const m = /^\s{2}neo4j:\s*\n(?:\s{4}.*\n)*?\s{4}image:\s*["']?([^\s"']+)/m.exec(text);
  return m?.[1];
}

export function defaultHardware(): EnvironmentRecord['hardware'] {
  const cpus = os.cpus();
  return { cpu: cpus[0]?.model ?? 'unknown', cores: Math.max(1, cpus.length), memGb: Math.round((os.totalmem() / 2 ** 30) * 10) / 10, os: `${os.platform()} ${os.release()} ${os.arch()}` };
}

/** First value row of `cypher-shell --format plain` output, unquoted. */
export function plainValue(stdout: string): string | undefined {
  const rows = stdout.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const value = rows[1];
  return value === undefined ? undefined : value.replace(/^"(.*)"$/, '$1');
}

export async function recordEnvironment(opts: RecordEnvOptions): Promise<EnvOutcome> {
  const fail = (detail: string): EnvOutcome => ({ ok: false, code: ENV_RECORD_FAILED, detail });
  const secrets = knownSecretsOf(opts.parentEnv);
  const childEnv: Record<string, string> = { ...buildChildEnv(opts.parentEnv, ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONFIG']) };
  const run = async (command: string, args: readonly string[], env: Readonly<Record<string, string>> = childEnv): Promise<{ ok: true; stdout: string } | { ok: false; detail: string }> => {
    const r = await opts.runner.run(command, args, { cwd: opts.repoRoot, env, timeoutMs: SUBPROCESS_TIMEOUT_MS });
    if (!r.success) return { ok: false, detail: `${command}: ${r.errors.map((e) => e.message).join('; ')}` };
    if (r.data.exitCode !== 0 || r.data.timedOut) return { ok: false, detail: `${command} ${args[0] ?? ''} exit ${String(r.data.exitCode)}: ${r.data.stderr.trim().slice(0, 300)}` };
    return { ok: true, stdout: r.data.stdout };
  };

  const git = await run('git', ['rev-parse', 'HEAD']);
  if (!git.ok) return fail(git.detail);
  const tag = composeNeo4jImage(opts.repoRoot);
  if (tag === undefined) return fail('docker-compose.yml has no neo4j image');
  const inspect = await run('docker', ['image', 'inspect', tag, '--format', '{{json .}}']);
  if (!inspect.ok) return fail(inspect.detail);
  let image: { Id?: string; RepoDigests?: string[] };
  try {
    image = JSON.parse(inspect.stdout) as { Id?: string; RepoDigests?: string[] };
  } catch {
    return fail('docker image inspect returned no JSON');
  }

  // cypher-shell credentials as child variables only (names passed with `-e`, values from the child env).
  const cypherEnv: Record<string, string> = { ...childEnv };
  if (opts.parentEnv.NEO4J_USER !== undefined) cypherEnv.NEO4J_USERNAME = opts.parentEnv.NEO4J_USER;
  if (opts.parentEnv.NEO4J_PASSWORD !== undefined) cypherEnv.NEO4J_PASSWORD = opts.parentEnv.NEO4J_PASSWORD;
  const target = opts.neo4jContainer !== undefined
    ? ['exec', '-e', 'NEO4J_USERNAME', '-e', 'NEO4J_PASSWORD', opts.neo4jContainer]
    : ['compose', 'exec', '-T', '-e', 'NEO4J_USERNAME', '-e', 'NEO4J_PASSWORD', 'neo4j'];
  const cypher = async (query: string): Promise<{ ok: true; value: string } | { ok: false; detail: string }> => {
    const r = await run('docker', [...target, 'cypher-shell', '--format', 'plain', query], cypherEnv);
    if (!r.ok) return r;
    const value = plainValue(r.stdout);
    return value === undefined ? { ok: false, detail: `no value from cypher-shell for ${query}` } : { ok: true, value };
  };
  const server = await cypher('CALL dbms.components() YIELD versions, edition RETURN versions[0] + " " + edition');
  if (!server.ok) return fail(server.detail);
  const apoc = await cypher('RETURN apoc.version()');
  if (!apoc.ok) return fail(apoc.detail);
  const claude = await run('claude', ['--version']);

  const versions = lockVersions(opts.repoRoot);
  const body = {
    gitCommit: git.stdout.trim(),
    node: process.version,
    typescript: versions.typescript, tsMorph: versions.tsMorph, neo4jDriver: versions.neo4jDriver, jest: versions.jest,
    neo4jImage: { tag, id: image.Id ?? 'unknown', repoDigests: [...(image.RepoDigests ?? [])].sort() },
    neo4jServer: server.value, apoc: apoc.value,
    geminiSdk: versions.geminiSdk,
    ...(claude.ok && claude.stdout.trim() !== '' && { claudeCli: claude.stdout.trim() }),
    ...(opts.labellerModelId !== undefined && { labellerModelId: opts.labellerModelId }),
    judgeModelIds: [...(opts.judgeModelIds ?? [])], generatorModelIds: [...(opts.generatorModelIds ?? [])],
    environmentDocSha256: createHash('sha256').update(readFileSync(join(opts.repoRoot, ENVIRONMENT_DOC))).digest('hex'),
    hardware: (opts.hardware ?? defaultHardware)(),
  };
  const clean = scrubbedJson(body, secrets);
  const id = `env-${createHash('sha256').update(canonicalize(clean)).digest('hex').slice(0, 12)}`;
  const record: EnvironmentRecord = { id, recordedAt: opts.now().toISOString(), ...clean };
  const problems = validateEnvironmentRecord(record, opts.repoRoot);
  if (problems.length > 0) return fail(`environment record fails ${ENV_SCHEMA}: ${problems.join('; ')}`);
  return { ok: true, record };
}

// ---------------------------------------------------------------------------------------------
// CLI

export const ENV_USAGE = [
  'Usage: npx tsx scripts/record-env-cli.ts [--neo4j-container <name>] [--out <file>]',
  '       npx tsx scripts/record-env-cli.ts --self-test',
].join('\n');

export interface EnvMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

export async function main(argv: readonly string[], repoRoot: string, io: EnvMainIo, runner: ProcessRunner = new NodeProcessRunner(), parentEnv: NodeJS.ProcessEnv = process.env): Promise<number> {
  let container: string | undefined;
  let outFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--neo4j-container' && argv[i + 1] !== undefined) container = argv[++i];
    else if (a === '--out' && argv[i + 1] !== undefined) outFile = argv[++i];
    else if (a === '--self-test') {
      // Known-bad input: a repository root without git, compose file or lock file.
      try {
        await main([], join(repoRoot, 'does-not-exist'), io, runner, parentEnv);
      } catch (e) {
        io.err(`${e instanceof Error ? e.message : String(e)}\n`);
      }
      return 1;
    } else {
      io.err(`${ENV_USAGE}\n`);
      return 2;
    }
  }
  const r = await recordEnvironment({ repoRoot, runner, parentEnv, now: () => new Date(), ...(container !== undefined && { neo4jContainer: container }) });
  if (!r.ok) {
    io.err(`${r.code}: ${r.detail}\n`);
    return 1;
  }
  const text = `${JSON.stringify(r.record, null, 2)}\n`;
  if (outFile === undefined) io.out(text);
  else io.writeFile(resolve(repoRoot, outFile), text);
  return 0;
}
