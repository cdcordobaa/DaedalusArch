import { BusinessError } from '../errors/BusinessError';
import { Money } from './Money';
import { OrderLine } from './OrderLine';

export class Order {
  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly lines: readonly OrderLine[],
    readonly createdAt: Date,
    readonly discount: Money,
    private orderStatus: 'placed' | 'cancelled' = 'placed',
  ) {
    if (lines.length === 0) throw new BusinessError('INVALID', 'An order needs at least one line');
  }

  get status(): 'placed' | 'cancelled' {
    return this.orderStatus;
  }

  subtotal(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.total()), Money.zero());
  }

  total(): Money {
    return this.subtotal().subtract(this.discount);
  }

  cancel(): void {
    if (this.orderStatus === 'cancelled') throw new BusinessError('CONFLICT', `Order ${this.id} is already cancelled`);
    this.orderStatus = 'cancelled';
  }
}
