export class Shipment {
  constructor(
    readonly id: string,
    readonly createdAt: Date,
    readonly trackingCode: string,
    readonly weightKg: number,
  ) {}
}
