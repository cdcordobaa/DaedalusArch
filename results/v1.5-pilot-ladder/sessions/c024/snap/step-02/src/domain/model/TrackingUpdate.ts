/** How a sent bouquet is doing, in the words shown to customers. */
export type DeliveryStage = 'preparing' | 'on its way' | 'delivered' | 'problem';

/** Where a parcel was last seen, for the staff log. */
export interface TrackingUpdate {
  /** The customer-facing stage derived from the courier's status. */
  readonly stage: DeliveryStage;
  readonly at: string;
  readonly place: string;
  /** The courier's own word for the step, lower case, printed in the staff log as is. */
  readonly stageCode: string;
}
