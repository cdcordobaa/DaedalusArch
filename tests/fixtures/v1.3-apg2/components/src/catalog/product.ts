import { Price } from '../pricing/price';
import { Registry } from '../kernel/registry';
export class Product {
  price = new Price();
  registry = new Registry();
}
