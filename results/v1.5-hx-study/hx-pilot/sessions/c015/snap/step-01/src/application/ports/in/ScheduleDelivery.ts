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
  readonly latitude: number;
  readonly longitude: number;
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
