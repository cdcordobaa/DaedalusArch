import { PermitOutcome } from './permit';

export const PERMIT_STAGES = ['LODGED', 'VETTED', 'GRANTED', 'DEFERRED', 'REVOKED', 'LAPSED'] as const;
export type PermitStage = (typeof PERMIT_STAGES)[number];

export function outcomeOf(stage: PermitStage): PermitOutcome {
  if (stage === 'GRANTED') return 'approved';
  if (stage === 'REVOKED' || stage === 'LAPSED') return 'refused';
  return 'pending';
}
