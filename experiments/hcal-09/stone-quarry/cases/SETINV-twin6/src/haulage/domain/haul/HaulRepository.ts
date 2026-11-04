import { Haul } from './Haul';

export interface HaulRepository {
  findByTruckAndShift(truckId: string, shiftDate: string): Promise<Haul[]>;
  tonnesHauled(truckId: string, shiftDate: string): Promise<number>;
  save(haul: Haul): Promise<void>;
}
