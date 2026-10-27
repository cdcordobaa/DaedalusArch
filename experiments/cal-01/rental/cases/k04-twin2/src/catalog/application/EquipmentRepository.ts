import { Equipment } from "../domain/equipment/Equipment";

export interface EquipmentRepository {
  save(equipment: Equipment): Promise<void>;
  findById(id: string): Promise<Equipment | undefined>;
  findBySerial(serial: string): Promise<Equipment | undefined>;
}
