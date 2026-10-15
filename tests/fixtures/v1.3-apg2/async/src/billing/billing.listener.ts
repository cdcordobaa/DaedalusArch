import { bus } from '../shared/bus';
// AS1 (subscriber half): billing reacts to orders without importing it.
export class BillingListener {
  constructor() {
    bus.on('order.placed', (id: string) => this.bill(id));
  }
  bill(id: string): void {
    void id;
  }
}
