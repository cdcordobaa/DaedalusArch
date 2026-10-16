export class Shipment {
  constructor(
    readonly id: string,
    readonly recipientEmail: string,
    readonly shippedAt: Date,
    readonly carrier: string,
  ) {}
}
