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
  /** Present when scheduled: the address as Geopin writes it. */
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  /** True when Geopin was unavailable and the address is as typed. */
  readonly unverified?: boolean;
  /** Present when rejected. */
  readonly reason?: string;
}

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
