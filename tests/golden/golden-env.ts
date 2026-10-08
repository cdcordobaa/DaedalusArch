/**
 * Shared environment guards for the golden suite (FR-30) and the Neo4j
 * infrastructure test (FR-01). Never loads .env and never falls back to a
 * default credential: the caller's shell must export NEO4J_PASSWORD.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface GoldenNeo4jConfig {
  readonly uri: string;
  readonly user: string;
  readonly password: string;
}

export type GoldenEnv =
  | { readonly enabled: true; readonly neo4j: GoldenNeo4jConfig }
  | { readonly enabled: false; readonly reason: string };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Minimum NEO4J_PASSWORD length accepted by the golden suite (BR-U2-43). */
export const MIN_GOLDEN_PASSWORD_LENGTH = 8;

const SNAPSHOT_DIR = path.join(__dirname, '__snapshots__');

/** Texts of the committed golden snapshots (`__snapshots__/*.json`); none → empty list. */
export function readSnapshotTexts(dir: string = SNAPSHOT_DIR): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return names.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}

/**
 * BR-U2-43 (Q14 A): a password that is too short or that appears in a
 * committed snapshot would let redaction corrupt the snapshot text or leak
 * through it. Returns the violated rule, never the value; undefined when ok.
 */
export function passwordRuleViolation(password: string, snapshotTexts: readonly string[]): string | undefined {
  if (password.length < MIN_GOLDEN_PASSWORD_LENGTH) {
    return `NEO4J_PASSWORD is shorter than ${String(MIN_GOLDEN_PASSWORD_LENGTH)} characters`;
  }
  if (snapshotTexts.some((t) => t.includes(password))) {
    return 'NEO4J_PASSWORD occurs in a committed golden snapshot (tests/golden/__snapshots__/*.json)';
  }
  return undefined;
}

function uriHost(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return '';
  }
}

function uriHasUserinfo(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.username !== '' || u.password !== '';
  } catch {
    return false;
  }
}

/** The URI without userinfo, safe for messages; unparseable → `<scheme>://<unparseable>`. */
export function redactUri(uri: string): string {
  try {
    const u = new URL(uri);
    u.username = '';
    u.password = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(uri)?.[1] ?? 'unknown';
    return `${scheme}://<unparseable>`;
  }
}

/**
 * Removes secrets from text before it is printed: every occurrence of the
 * password and the userinfo part of any `scheme://user:pass@` URI.
 */
export function redactSecrets(text: string, password: string): string {
  const withoutPassword = password === '' ? text : text.split(password).join('<redacted>');
  return withoutPassword.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1<redacted>@');
}

/** True only for a CI value that means "on": anything except '', '0', 'false'. */
export function isCiEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const ci = env['CI'];
  if (ci === undefined) return false;
  const v = ci.trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false';
}

/**
 * Resolves the Neo4j connection for the golden suite.
 * - `NEO4J_PASSWORD` unset: disabled (skip), unless `GOLDEN_REQUIRED=1` (throws).
 * - Host other than localhost/127.0.0.1: throws unless `GOLDEN_ALLOW_WIPE=1`,
 *   because ingestion wipes the database.
 * - URI carrying userinfo (`bolt://user:pass@host`): throws; credentials come
 *   only from NEO4J_USER/NEO4J_PASSWORD.
 * - Password shorter than 8 characters or contained in a committed snapshot
 *   (BR-U2-43): disabled (skip), unless `GOLDEN_REQUIRED=1` (throws).
 * Error messages name the redacted URI or the rule, never the password.
 */
export function resolveGoldenEnv(
  env: NodeJS.ProcessEnv = process.env,
  snapshotTexts: readonly string[] = readSnapshotTexts(),
): GoldenEnv {
  const required = env['GOLDEN_REQUIRED'] === '1';
  const password = env['NEO4J_PASSWORD'];
  if (password === undefined || password === '') {
    if (required) {
      throw new Error('GOLDEN_REQUIRED=1 but NEO4J_PASSWORD is not set; export it (e.g. `set -a; . ./.env; set +a`).');
    }
    return { enabled: false, reason: 'NEO4J_PASSWORD is not set; golden suite skipped (set GOLDEN_REQUIRED=1 to make this an error).' };
  }

  const violation = passwordRuleViolation(password, snapshotTexts);
  if (violation !== undefined) {
    if (required) {
      throw new Error(`GOLDEN_REQUIRED=1 but ${violation}; use a different password.`);
    }
    return { enabled: false, reason: `${violation}; golden suite skipped (set GOLDEN_REQUIRED=1 to make this an error).` };
  }

  const uri = env['NEO4J_URI'] ?? 'bolt://localhost:7687';
  if (uriHasUserinfo(uri)) {
    throw new Error(
      `Refusing NEO4J_URI ${redactUri(uri)} with embedded credentials; ` +
      'put the user and password in NEO4J_USER/NEO4J_PASSWORD instead.',
    );
  }
  const host = uriHost(uri);
  if (!LOCAL_HOSTS.has(host) && env['GOLDEN_ALLOW_WIPE'] !== '1') {
    throw new Error(
      `Refusing to run the golden suite against ${redactUri(uri)}: ingestion wipes the database. ` +
      'Use localhost/127.0.0.1 or set GOLDEN_ALLOW_WIPE=1.',
    );
  }

  return { enabled: true, neo4j: { uri, user: env['NEO4J_USER'] ?? 'neo4j', password } };
}
