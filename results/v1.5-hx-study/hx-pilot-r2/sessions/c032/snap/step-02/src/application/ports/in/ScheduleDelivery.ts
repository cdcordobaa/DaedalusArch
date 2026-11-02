export interface DeliveryRequest {
  readonly orderId: string;
  readonly street: string;
  readonly postcode: string;
  readonly city: string;
  readonly country: string;
}

export interface DeliveryView {
  readonly orderId: string;
  readonly status: string;
  /** For a scheduled delivery, the address as Geopin writes it. */
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  /** True when Geopin could not check the address and it is the customer's own text. */
  readonly unverified?: boolean;
  /** Set when the delivery is rejected. */
  readonly reason?: string;
}

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
