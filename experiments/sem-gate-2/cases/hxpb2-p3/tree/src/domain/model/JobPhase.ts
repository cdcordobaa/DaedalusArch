/** The phase of a marketplace job. */
export type JobPhase = 'advertised' | 'accepted' | 'inDraft' | 'inProof' | 'handedOver' | 'challenged';

/** The phase for the state text a job snapshot carries. */
export function jobPhaseOf(stateCode: string): JobPhase {
  if (stateCode === 'posted') return 'advertised';
  if (stateCode === 'claimed') return 'accepted';
  if (stateCode === 'drafting') return 'inDraft';
  if (stateCode === 'proofreading') return 'inProof';
  if (stateCode === 'delivered') return 'handedOver';
  if (stateCode === 'disputed') return 'challenged';
  throw new Error('unknown job state ' + stateCode);
}
