import { Rental } from "../domain/rental/Rental";

export interface RentalRepository {
  save(rental: Rental): Promise<void>;
  findById(id: string): Promise<Rental | undefined>;
  findOpenByEquipment(equipmentId: string): Promise<Rental[]>;
  saveBoth(first: Rental, second: Rental): Promise<void>;
}
