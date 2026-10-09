/**
 * Forced site of each SP-* probe on `fixtures/correct-reference` (BR-U5a-30; U5a plan Step 33; Build and Test Step 28).
 *
 * A probe is applied once, at one forced site: the file below plus a predicate over the site detail that the probe's
 * own `findSites` returns. The table was first written in `tests/unit/scripts/mutation/sp-probes.test.ts`; it lives
 * here so that the registered sensitivity entries (`../daedalus-sp-probes/`, `scripts/sp-probe-copies-cli.ts`) and the
 * unit test pick the same sites. The values are unchanged from the test (U5a Step 33).
 */
import type { MutationSite } from '../../types.js';

const TASK = 'src/domain/entities/Task.ts';
const CATEGORY = 'src/domain/entities/Category.ts';
const ICAT = 'src/domain/repositories/ICategoryRepository.ts';
const ITASK = 'src/domain/repositories/ITaskRepository.ts';
const CREATE = 'src/application/use-cases/CreateTaskUseCase.ts';
const ICREATE = 'src/application/use-cases/ICreateTaskUseCase.ts';
const IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
const CTRL = 'src/infrastructure/controllers/TaskController.ts';
const ORPHAN = 'src/application/use-cases/OrphanHelper.ts';

export interface ForcedSite {
  readonly filePath: string;
  readonly match?: (detail: Readonly<Record<string, string>>) => boolean;
}

export const SP_FORCED_SITES: Readonly<Record<string, ForcedSite>> = Object.freeze({
  'SP-FF-S01': { filePath: CATEGORY, match: (d) => d.targetFile === IMPL },
  'SP-FF-S02': { filePath: CATEGORY, match: (d) => d.targetFile === ICAT },
  'SP-FF-S03': { filePath: CTRL, match: (d) => d.targetFile === IMPL },
  'SP-FF-S04': { filePath: CATEGORY, match: (d) => d.targetFile === ICREATE },
  'SP-FF-P01': { filePath: TASK, match: (d) => d.package === 'express' },
  'SP-FF-P02': { filePath: CREATE },
  'SP-FF-P03': { filePath: IMPL },
  'SP-FF-P04': { filePath: CREATE, match: (d) => (d.deps ?? '').startsWith('InMemoryTaskRepository=') },
  'SP-FF-P05': { filePath: CTRL },
  'SP-DF01-ci': { filePath: CATEGORY, match: (d) => d.targetName === 'InMemoryTaskRepository' },
  'SP-FF-C01': { filePath: CATEGORY },
  'SP-FF-C02': { filePath: CATEGORY },
  'SP-FF-C03': { filePath: CATEGORY },
  'SP-FF-C04': { filePath: ORPHAN },
  'SP-FF-C05': { filePath: TASK },
  'SP-FF-C06': { filePath: 'src/application/use-cases/ProbeAbstraction.ts' },
  'SP-FF-SO01': { filePath: TASK },
  'SP-FF-SO02': { filePath: ITASK },
  'SP-FF-SO03': { filePath: 'src/application/use-cases/ProbeHierarchy.ts' },
  'SP-FF-CV01': { filePath: CATEGORY },
  'SP-FF-CV02': { filePath: CREATE },
  'SP-FF-CV03': { filePath: IMPL },
  'SP-FF-CV04': { filePath: CTRL },
  'SP-FF-CV05': { filePath: ORPHAN, match: (d) => d.importer === CREATE },
  'SP-FF-CV06': { filePath: 'src/domain/entities/index.ts' },
});

/** The forced site among `sites` (a probe's `findSites` output), or undefined. */
export function forcedSiteOf(probeId: string, sites: readonly MutationSite[]): MutationSite | undefined {
  const want = SP_FORCED_SITES[probeId];
  if (want === undefined) return undefined;
  return sites.find((s) => s.filePath === want.filePath && (want.match?.(s.detail) ?? true));
}
