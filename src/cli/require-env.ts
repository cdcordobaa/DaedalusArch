/**
 * Required environment variables of the CLI (C9; D-U0-8; U3 BR-U3-80; SECURITY-09, SECURITY-12).
 *
 * Every `NEO4J_PASSWORD` read in `src/cli/**` goes through `requireEnv`; there is no default
 * password. A missing or empty variable stops the command with `CONFIG_MISSING_ENV` before any
 * Neo4j connection is attempted. `NEO4J_USER` keeps its `neo4j` default (not a secret).
 */

/** Error code of a missing or empty required variable (`domain-entities.md` §6.3). */
export const CONFIG_MISSING_ENV = 'CONFIG_MISSING_ENV';

/** Exit code of a command stopped by a missing variable (2 = error, as every CLI error). */
export const MISSING_ENV_EXIT_CODE = 2;

export class MissingEnvError extends Error {
  readonly code = CONFIG_MISSING_ENV;

  constructor(readonly variable: string) {
    super(`${variable} is not set`);
    this.name = 'MissingEnvError';
  }
}

/** The variable's value; throws `MissingEnvError` when it is unset or empty. */
export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (value === undefined || value === '') throw new MissingEnvError(name);
  return value;
}

/** One-line stderr text of the error (names the variable, never a value). */
export function missingEnvMessage(error: MissingEnvError): string {
  return `Error [${error.code}]: ${error.message}\n`;
}

/**
 * `requireEnv` for a CLI action: on a missing variable, prints the message, sets the exit code and
 * returns `undefined` so the action returns before building a pipeline.
 */
export function requireEnvForCli(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  try {
    return requireEnv(name, env);
  } catch (err) {
    if (!(err instanceof MissingEnvError)) throw err;
    process.stderr.write(missingEnvMessage(err));
    process.exitCode = MISSING_ENV_EXIT_CODE;
    return undefined;
  }
}
