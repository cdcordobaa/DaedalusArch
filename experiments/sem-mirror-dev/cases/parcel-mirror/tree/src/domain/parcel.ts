export type ParcelStage = 'Created' | 'Moving' | 'OutForDelivery' | 'Done' | 'Problem' | 'Back';

export interface ParcelUpdate {
  readonly trackingNumber: string;
  readonly stage: ParcelStage;
  readonly at: Date;
}
