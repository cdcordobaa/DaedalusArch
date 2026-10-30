/** The courier's steps, as the shop understands them. */
export type ParcelStage = 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delivery_failed';

/** Where a parcel was last seen, for the staff log. */
export interface TrackingUpdate {
  readonly at: string;
  readonly place: string;
  /** The courier's own word for the step, lower case, printed in the staff log as is. */
  readonly stageCode: string;
  readonly stage: ParcelStage;
}
