/** The steps of a firing the studio tells apart. */
export type FiringStep = 'booked' | 'heating' | 'soaking' | 'cooling' | 'ready' | 'failed';

/** The studio step for the phase text a kiln reading carries. */
export function firingStepOf(phaseCode: string): FiringStep {
  switch (phaseCode) {
    case 'scheduled':
    case 'candling':
      return 'booked';
    case 'ramping': return 'heating';
    case 'holding': return 'soaking';
    case 'cooling': return 'cooling';
    case 'complete': return 'ready';
    default: return 'failed';
  }
}
