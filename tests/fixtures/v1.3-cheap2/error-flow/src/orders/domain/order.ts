import { NotFoundException } from '@nestjs/common';
import { OrderError } from './order-error';

export class Order {
  constructor(readonly id: string, private confirmed = false, private readonly lines: number[] = []) {}

  /** PLANTED P1: an HTTP exception in the domain. */
  line(index: number): number {
    const l = this.lines[index];
    if (l === undefined) throw new NotFoundException(`no line ${String(index)}`);
    return l;
  }

  confirm(): void {
    if (this.confirmed) throw new OrderError('ALREADY', `order ${this.id} is already confirmed`);
    this.confirmed = true;
  }

  /** NEAR-MISS N6: a catch-all in the domain itself is not an adapter's swallow. */
  tryConfirm(): boolean {
    try {
      this.confirm();
      return true;
    } catch {
      return false;
    }
  }
}
