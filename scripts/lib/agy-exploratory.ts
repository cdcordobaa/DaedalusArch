/**
 * The agy versions accepted for EXPLORATORY runs (author decisions 2026-10-19: agy 1.3.6, then 1.4.2, auto-updated
 * that morning). Shared by the BF-01 labeller route (`scripts/v1.3/bf-01-run.ts`) and the Gemini generator
 * (`scripts/lib/generators/agy-gen-plan.ts`). The frozen labeller pin (`AGY_PINNED_VERSION`, 1.3.2) is unchanged.
 */
export const AGY_EXPLORATORY_VERSIONS: readonly string[] = Object.freeze(['1.3.6', '1.4.2']);
