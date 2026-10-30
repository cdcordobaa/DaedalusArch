export interface PickupPointView {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface FindPickupPoints {
  near(postcode: string, country: string): Promise<PickupPointView[]>;
}
