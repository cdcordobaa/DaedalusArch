/** The steps of an order the client portal tells apart. */
export type PortalStep = 'unclaimed' | 'inWork' | 'inReview' | 'complete' | 'paused';

/** The portal step for the state text a job snapshot carries. */
export function portalStepOf(stateCode: string): PortalStep {
  if (stateCode === 'posted') return 'unclaimed';
  if (stateCode === 'claimed' || stateCode === 'drafting') return 'inWork';
  if (stateCode === 'proofreading') return 'inReview';
  if (stateCode === 'delivered') return 'complete';
  return 'paused';
}
