import { RentalRepository } from "../application/RentalRepository";
import { Extension, Rental } from "../domain/rental/Rental";

export class InMemoryRentalRepository implements RentalRepository {
  private readonly items = new Map<string, Rental>();
  private readonly extensionRows = new Map<string, Extension[]>();

  async save(rental: Rental): Promise<void> {
    this.items.set(rental.id, rental);
    this.extensionRows.set(rental.id, [...rental.extensions]);
  }

  async findById(id: string): Promise<Rental | undefined> {
    return this.items.get(id);
  }

  async findOpenByEquipment(equipmentId: string): Promise<Rental[]> {
    return [...this.items.values()].filter((r) => r.equipmentId === equipmentId && r.status === "open");
  }
}
