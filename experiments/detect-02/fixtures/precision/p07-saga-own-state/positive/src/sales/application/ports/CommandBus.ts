export interface ShipOrder {
  readonly kind: 'ShipOrder';
  readonly orderId: string;
}

export interface CommandBus {
  send(command: ShipOrder): Promise<void>;
}
