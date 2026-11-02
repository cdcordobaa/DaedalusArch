/** Where a firing is. */
export type KilnStep = 'booked' | 'drying' | 'climbing' | 'atPeak' | 'coolingDown' | 'finished' | 'failed';

/** The step for the phase text a kiln reading carries. */
export function kilnStepOf(phaseCode: string): KilnStep {
  switch (phaseCode) {
    case 'scheduled': return 'booked';
    case 'candling': return 'drying';
    case 'ramping': return 'climbing';
    case 'holding': return 'atPeak';
    case 'cooling': return 'coolingDown';
    case 'complete': return 'finished';
    case 'faulted': return 'failed';
    default: throw new Error('unknown kiln phase ' + phaseCode);
  }
}
