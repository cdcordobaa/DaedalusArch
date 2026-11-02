export interface DeliveryRequest {
  readonly orderId: string;
  readonly street: string;
  readonly postcode: string;
  readonly city: string;
  readonly country: string;
}

export interface DeliveryView {
  readonly orderId: string;
  readonly status: 'scheduled' | 'rejected';
  /** The address as Geopin writes it; only present when scheduled. */
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  /** Only present when rejected. */
  readonly reason?: string;
}

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
