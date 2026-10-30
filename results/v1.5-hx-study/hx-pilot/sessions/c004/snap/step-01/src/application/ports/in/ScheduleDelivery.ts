export interface DeliveryRequest {
  readonly orderId: string;
  readonly street: string;
  readonly postcode: string;
  readonly city: string;
  readonly country: string;
}

export type DeliveryView =
  | {
      readonly orderId: string;
      readonly status: 'scheduled';
      readonly address: string;
      readonly latitude: number;
      readonly longitude: number;
    }
  | {
      readonly orderId: string;
      readonly status: 'rejected';
      readonly reason: string;
    };

export interface ScheduleDelivery {
  schedule(request: DeliveryRequest): Promise<DeliveryView>;
}
