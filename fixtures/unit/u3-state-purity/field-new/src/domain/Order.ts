// TF-02 (U3 BR-U3-22): a domain class stores an infrastructure repository with `new` (one FLOWS_TO edge).
import { InMemoryOrderRepository } from '../infrastructure/InMemoryOrderRepository';

export class Order {
  private readonly repo = new InMemoryOrderRepository();

  place(id: string): void {
    this.repo.save(id);
  }
}
