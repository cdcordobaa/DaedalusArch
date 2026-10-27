import { RentalRepository } from "../application/RentalRepository";
import { Rental } from "../domain/rental/Rental";

export class InMemoryRentalRepository implements RentalRepository {
  private readonly items = new Map<string, Rental>();

  async save(rental: Rental): Promise<void> {
    this.items.set(rental.id, rental);
  }

  async findById(id: string): Promise<Rental | undefined> {
    return this.items.get(id);
  }

  async findOpenByEquipment(equipmentId: string): Promise<Rental[]> {
    return [...this.items.values()].filter((r) => r.equipmentId === equipmentId && r.status === "open");
  }

  async saveBoth(first: Rental, second: Rental): Promise<void> {
    this.items.set(first.id, first);
    this.items.set(second.id, second);
  }
}
