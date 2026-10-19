/**
 * The agy versions accepted for EXPLORATORY runs (author decisions 2026-10-19: agy 1.3.6, then 1.4.2, auto-updated
 * that morning). One shared list: it is defined in `src/llm-critic/agy-cli-provider.ts` and re-exported here for the
 * Gemini generator (`scripts/lib/generators/agy-gen-plan.ts`). The frozen labeller pin (`AGY_PINNED_VERSION`, 1.3.2)
 * is unchanged.
 */
export { AGY_EXPLORATORY_VERSIONS } from '../../src/llm-critic/agy-cli-provider.js';
