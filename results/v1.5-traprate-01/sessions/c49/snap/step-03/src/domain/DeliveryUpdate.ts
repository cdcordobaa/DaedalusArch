/** Where a supplier delivery to the blood bank stands, in our own words. */
export type DeliveryState = 'being packed' | 'on the way' | 'delivered';

export interface DeliveryUpdate {
  readonly state: DeliveryState;
  /** ISO 8601 time of the latest change. */
  readonly at: string;
}
