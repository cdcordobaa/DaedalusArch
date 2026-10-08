/**
 * Generator child environment (FR-v1.2E-28; SECURITY-11; NFR-v1.2E-08; BR-U5a-44; D-1).
 *
 * `buildGeneratorChildEnv(parent)` copies only `GENERATOR_ENV_ALLOW` through C10 `buildChildEnv`, then removes, by
 * name, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` and every
 * `*_TOKEN` / `*_KEY` variable. The removal is redundant with the allow-list today and is kept so a future widening
 * of the list cannot leak a credential: the CLI must use the subscription login (D-1). `parent` is never mutated.
 */
import { buildChildEnv } from '../../../src/shared/process/node-process-runner.js';
import { GENERATOR_ENV_ALLOW } from './types.js';

export { GENERATOR_ENV_ALLOW };

/** Variables removed by name whatever the allow-list says. */
export const GENERATOR_ENV_DENY: readonly string[] = Object.freeze([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
]);

/** Suffixes removed whatever the allow-list says (case-insensitive). */
const DENY_SUFFIX = /_(?:TOKEN|KEY)$/i;

export function isDeniedGeneratorVar(name: string): boolean {
  return GENERATOR_ENV_DENY.includes(name) || DENY_SUFFIX.test(name);
}

export function buildGeneratorChildEnv(
  parent: NodeJS.ProcessEnv,
  allow: readonly string[] = GENERATOR_ENV_ALLOW,
): Readonly<Record<string, string>> {
  const base = buildChildEnv(parent, allow);
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(base)) {
    if (!isDeniedGeneratorVar(name)) env[name] = value;
  }
  return Object.freeze(env);
}
