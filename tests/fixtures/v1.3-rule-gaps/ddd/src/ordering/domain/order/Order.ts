import { Customer } from '../customer/Customer';
import { CustomerId } from '../customer/value-objects/CustomerId';
import { OrderLine } from './OrderLine';

export class Order {
  private readonly lines: OrderLine[] = [];
  // violating (aggregate-reference-by-identity): a direct reference to another aggregate's root.
  private buyer: Customer | undefined;
  // clean: the other aggregate is referenced by identity.
  constructor(readonly id: string, readonly customerId: CustomerId) {}
  attachBuyer(c: Customer): void {
    this.buyer = c;
  }
  add(line: OrderLine): void {
    this.lines.push(line);
  }
  buyerName(): string {
    return this.buyer?.id.value ?? '';
  }
}
