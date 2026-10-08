// TF-03 (U3 BR-U3-22): the repository is injected through the constructor (CONSTRUCTOR_INJECTS, no line).
import { InMemoryOrderRepository } from '../infrastructure/InMemoryOrderRepository';

export class Order {
  constructor(private readonly repo: InMemoryOrderRepository) {}

  place(id: string): void {
    this.repo.save(id);
  }
}
