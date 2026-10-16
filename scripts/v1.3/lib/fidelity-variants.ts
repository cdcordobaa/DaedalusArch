/**
 * Extractor options of the graph-fidelity variants (`scripts/v1.3/graph-fidelity.ts`).
 *
 * R11 (post-merge review 2026-10-16): the 'apg-v13-dynamicImports' variant isolates the `dynamicImports` option, so it
 * is the v1.2E options with that one flag on. `{ dynamicImports: true }` alone merges over the extractor's own
 * defaults, which on the v1.3 branch also turn on both re-export edge views, module wiring, member facts and alias
 * declaration packages. Older extractor trees ignore the keys they do not know.
 */
import { V12E_DEFAULT_OPTIONS } from '../../../src/apg-extractor/index.js';

export const DYNAMIC_IMPORTS_VARIANT_OPTIONS = Object.freeze({ ...V12E_DEFAULT_OPTIONS, dynamicImports: true });
