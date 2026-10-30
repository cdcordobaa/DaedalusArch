export type DeliveryOutcome = 'pending' | 'delivered' | 'failed';

export interface ParcelUpdate {
  readonly trackingNumber: string;
  readonly outcome: DeliveryOutcome;
  readonly at: Date;
}
