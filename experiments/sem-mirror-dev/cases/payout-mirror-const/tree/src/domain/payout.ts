export const PayoutState = {
  Queued: 'queued',
  Sent: 'sent',
  Bounced: 'bounced',
  HeldCompliance: 'held-compliance',
} as const;
export type PayoutState = (typeof PayoutState)[keyof typeof PayoutState];

export interface PayoutView {
  readonly id: string;
  readonly state: PayoutState;
}
