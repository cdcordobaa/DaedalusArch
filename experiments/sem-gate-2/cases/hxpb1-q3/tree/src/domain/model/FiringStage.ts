/** The firing stages of the studio's firing book (ARCHITECTURE.md, studio glossary). */
export enum FiringStage {
  Queued = 'queued',
  Drying = 'drying',
  Heating = 'heating',
  Soaking = 'soaking',
  Easing = 'easing',
  Done = 'done',
  Broken = 'broken',
}

/** The stage for the phase text a kiln reading carries. */
export const STAGE_OF_PHASE: Readonly<Record<string, FiringStage>> = {
  scheduled: FiringStage.Queued,
  candling: FiringStage.Drying,
  ramping: FiringStage.Heating,
  holding: FiringStage.Soaking,
  cooling: FiringStage.Easing,
  complete: FiringStage.Done,
  faulted: FiringStage.Broken,
};
