/** Where the kiln is in a firing. */
export enum KilnStage {
  Queued = 'Queued',
  Drying = 'Drying',
  Heating = 'Heating',
  Soaking = 'Soaking',
  Easing = 'Easing',
  Done = 'Done',
  Broken = 'Broken',
}

/** The stage for the phase text a kiln reading carries. */
export const STAGE_OF_PHASE: Readonly<Record<string, KilnStage>> = {
  scheduled: KilnStage.Queued,
  candling: KilnStage.Drying,
  ramping: KilnStage.Heating,
  holding: KilnStage.Soaking,
  cooling: KilnStage.Easing,
  complete: KilnStage.Done,
  faulted: KilnStage.Broken,
};
