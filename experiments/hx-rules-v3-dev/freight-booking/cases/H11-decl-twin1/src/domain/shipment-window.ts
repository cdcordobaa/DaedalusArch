export class ShipmentWindow {
  constructor(readonly earliest: Date, readonly latest: Date) {
    if (latest < earliest) throw new Error('a shipment window ends after it starts');
  }

  contains(day: Date): boolean {
    return day >= this.earliest && day <= this.latest;
  }
}
