/** A bouquet ordered for a recipient; the card message goes with it. */
export interface Order {
  readonly orderId: string;
  readonly recipient: string;
  readonly street: string;
  readonly postcode: string;
  readonly city: string;
  readonly message: string;
  /** Bouquets with a bottle of wine need an adult to sign. */
  readonly signature: 'none' | 'adult';
  readonly trackingCode?: string;
  readonly state: 'ordered' | 'sent' | 'cancelled';
}
