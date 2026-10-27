import { EquipmentRepository } from "../application/EquipmentRepository";
import { Equipment } from "../domain/equipment/Equipment";

export class InMemoryEquipmentRepository implements EquipmentRepository {
  private readonly items = new Map<string, Equipment>();

  async save(equipment: Equipment): Promise<void> {
    for (const other of this.items.values()) {
      if (other.serial === equipment.serial && other.id !== equipment.id) {
        throw new Error("serial already registered");
      }
    }
    this.items.set(equipment.id, equipment);
  }

  async findById(id: string): Promise<Equipment | undefined> {
    return this.items.get(id);
  }

  async replace(retired: Equipment, replacement: Equipment): Promise<void> {
    this.items.set(retired.id, retired);
    this.items.set(replacement.id, replacement);
  }
}
