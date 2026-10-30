/** Where a parcel was last seen, for the staff log. */
export interface TrackingUpdate {
  readonly at: string;
  readonly place: string;
  /** The courier's own word for the step, lower case, printed in the staff log as is. */
  readonly stageCode: string;
}
