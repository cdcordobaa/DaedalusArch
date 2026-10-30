/** What the customer sees on the order page for a sent bouquet. */
export type DeliveryProgress = 'PREPARING' | 'ON_ITS_WAY' | 'DELIVERED' | 'PROBLEM';

/** Where a parcel was last seen, for the staff log. */
export interface TrackingUpdate {
  readonly progress: DeliveryProgress;
  readonly at: string;
  readonly place: string;
  /** The courier's own word for the step, lower case, printed in the staff log as is. */
  readonly stageCode: string;
}
