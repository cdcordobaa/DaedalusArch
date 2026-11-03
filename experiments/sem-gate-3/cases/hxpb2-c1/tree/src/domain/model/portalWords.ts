/** The portal's word for where a marketplace job is. */
export function portalWordOf(stateCode: string): string {
  if (stateCode === 'posted') return 'FINDING_TRANSLATOR';
  if (stateCode === 'claimed' || stateCode === 'drafting') return 'IN_TRANSLATION';
  if (stateCode === 'proofreading') return 'BEING_CHECKED';
  if (stateCode === 'delivered') return 'READY_TO_DOWNLOAD';
  return 'ON_HOLD';
}
