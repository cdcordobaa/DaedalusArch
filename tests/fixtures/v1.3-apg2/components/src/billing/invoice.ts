import { Label } from '../shipping/label';
import { Registry } from '../kernel/registry';
export class Invoice {
  label = new Label();
  registry = new Registry();
}
