export interface GuidePolicy {
  readonly quota: number;
}

export const GUIDE_POLICY: GuidePolicy = { quota: 6 };

export function guidesNeeded(partySize: number, policy: GuidePolicy = GUIDE_POLICY): number {
  return Math.ceil(partySize / policy.quota);
}
