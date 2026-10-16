export class Order {
  constructor(readonly id: string) {}
}

export interface OrderSnapshot {
  readonly id: string;
}
