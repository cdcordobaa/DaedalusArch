// CP1: shipping -> billing; billing/invoice.ts -> shipping/label.ts closes a component-level cycle. No file cycle.
import { Rates } from '../billing/rates';
export class Tracker {
  rates = new Rates();
}
