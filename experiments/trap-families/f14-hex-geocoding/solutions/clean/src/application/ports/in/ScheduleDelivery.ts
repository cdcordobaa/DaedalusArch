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
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly unverified?: boolean;
  /** For the customer when the address is rejected. */
  readonly reason?: string;
}

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
