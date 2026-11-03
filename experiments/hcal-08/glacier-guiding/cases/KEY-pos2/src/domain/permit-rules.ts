import { PermitOutcome } from './permit';

export function outcomeOf(state: string): PermitOutcome {
  if (state === 'GRANTED') return 'approved';
  if (state === 'LODGED' || state === 'VETTED' || state === 'DEFERRED') return 'pending';
  return 'refused';
}
