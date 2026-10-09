/**
 * Instrument v2 role exemptions (ADR-026, POST-HOC, pending review).
 *
 * Library-level, declarative path exemptions per template, applied in every spec in addition to the
 * function's own `exclude_paths` (C9, BR-U1-32). They live here, not in the corpus specs, because the
 * registered spec bytes are bound to the SO4 manifest by `specSha256` and because E7-generated specs must
 * get the same instrument as the hand-written ones.
 *
 * Each group names a file role by a widely used naming convention, and each template lists only roles its own
 * stated intent does not cover. No structural template (FF-S*, FF-P06, cycles) and no template with an SO4
 * expected key has an entry.
 *
 * Globs here are compiled with `segmentGlobstar` (`**\/` = zero or more whole directories), so
 * `**\/main.ts` does not match `src/domain.ts`.
 */
import { globToRegex } from './glob-to-regex.js';

/** Instrument version of the symbolic rule set. v1 = no role exemptions (prereg v9 and before). */
export const INSTRUMENT_VERSION = 2;

/**
 * Composition roots: the NestJS bootstrap file and `@Module` DI declaration files. They import what they wire
 * by design (precedent: every NestJS corpus spec already excludes `**\/*.module.ts` from FF-S03 as "DI wiring").
 */
export const COMPOSITION_ROOT_GLOBS: readonly string[] = Object.freeze([
  '**/main.ts',
  '**/*.module.ts',
]);

/**
 * Declaration-only files: data-transfer objects, type declarations and barrels, which carry no behaviour of
 * their own to unit-test (the template already skips graph-detected barrels, `NOT src.isBarrel`).
 */
export const DECLARATION_ONLY_GLOBS: readonly string[] = Object.freeze([
  '**/*.dto.ts',
  '**/dto/**',
  '**/dtos/**',
  '**/*.interface.ts',
  '**/*.type.ts',
  '**/*.types.ts',
  '**/*.enum.ts',
  '**/index.ts',
]);

/** Role exemptions per template name (instrument v2). A template absent here has none. */
export const ROLE_EXEMPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'test-file-pairing': Object.freeze([...DECLARATION_ONLY_GLOBS, ...COMPOSITION_ROOT_GLOBS]),
  'module-fan-out': COMPOSITION_ROOT_GLOBS,
  'component-instability': COMPOSITION_ROOT_GLOBS,
});

/** The role-exemption globs of `templateName` (empty when it has none). */
export function roleExemptionGlobs(templateName: string): readonly string[] {
  return ROLE_EXEMPTIONS[templateName] ?? [];
}

/** The role-exemption globs of `templateName` as anchored regexes for `$excludePatterns`. */
export function roleExemptionPatterns(templateName: string): string[] {
  return roleExemptionGlobs(templateName).map((g) => globToRegex(g, { segmentGlobstar: true }));
}
