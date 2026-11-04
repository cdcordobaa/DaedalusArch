import { Haul } from './Haul';

export interface HaulRepository {
  findByTruckAndShift(truckId: string, shiftDate: string): Promise<Haul[]>;
  save(haul: Haul): Promise<void>;
}
