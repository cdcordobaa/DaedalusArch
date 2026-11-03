import { RouteCondition } from './route-condition';

export type SkyReading = 'CALM' | 'GUSTY' | 'WHITEOUT';

export function conditionFromSky(reading: SkyReading): RouteCondition {
  if (reading === 'WHITEOUT') return 'closed';
  return reading === 'GUSTY' ? 'caution' : 'open';
}
