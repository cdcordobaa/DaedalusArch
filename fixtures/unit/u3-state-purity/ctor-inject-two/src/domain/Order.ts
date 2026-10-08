// TF-04 (U3 BR-U3-22): two injected parameters of the same infrastructure type.
import { InMemoryOrderRepository } from '../infrastructure/InMemoryOrderRepository';

export class Order {
  constructor(
    private readonly a: InMemoryOrderRepository,
    private readonly b: InMemoryOrderRepository,
  ) {}

  place(id: string): void {
    this.a.save(id);
    this.b.save(id);
  }
}
