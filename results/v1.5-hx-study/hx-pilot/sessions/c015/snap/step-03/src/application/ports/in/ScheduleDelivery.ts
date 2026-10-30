export interface DeliveryRequest {
  readonly orderId: string;
  readonly street: string;
  readonly postcode: string;
  readonly city: string;
  readonly country: string;
}

export interface ScheduledDeliveryView {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  /** Absent when the address could not be checked. */
  readonly latitude?: number;
  readonly longitude?: number;
  /** True when the address service was unavailable and the address is as the customer typed it. */
  readonly unverified: boolean;
}

export interface RejectedDeliveryView {
  readonly orderId: string;
  readonly status: 'rejected';
  readonly reason: string;
}

export type DeliveryView = ScheduledDeliveryView | RejectedDeliveryView;

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
