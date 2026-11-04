import { PilotageJob } from '@harbor/domain/pilotage-job';

/** Demo rows for local runs. */
export const seedJobs = (): PilotageJob[] => [
  new PilotageJob('PJ-1041', '9321483', 'AG-7', 10.4, '2026-11-12T04:00:00Z'),
  new PilotageJob('PJ-1042', '9478115', 'AG-2', 7.9, '2026-11-12T13:30:00Z'),
];
