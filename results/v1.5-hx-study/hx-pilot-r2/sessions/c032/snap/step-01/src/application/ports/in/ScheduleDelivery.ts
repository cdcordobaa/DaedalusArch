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
  /** Set when the delivery is rejected. */
  readonly reason?: string;
}

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
