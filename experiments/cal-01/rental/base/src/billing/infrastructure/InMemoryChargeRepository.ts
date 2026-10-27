import { ChargeRepository } from "../application/ChargeRepository";
import { Charge } from "../domain/charge/Charge";

export class InMemoryChargeRepository implements ChargeRepository {
  private readonly items = new Map<string, Charge>();

  async save(charge: Charge): Promise<void> {
    this.items.set(charge.id, charge);
  }

  async findById(id: string): Promise<Charge | undefined> {
    return this.items.get(id);
  }
}
