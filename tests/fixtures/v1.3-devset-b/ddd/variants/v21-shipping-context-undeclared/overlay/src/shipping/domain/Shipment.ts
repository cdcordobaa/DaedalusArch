export class Shipment {
  private dispatched = false;

  constructor(readonly shipmentId: string, readonly orderId: string) {}

  dispatch(): void {
    if (this.dispatched) throw new Error('Shipment already dispatched');
    this.dispatched = true;
  }

  isDispatched(): boolean {
    return this.dispatched;
  }
}
