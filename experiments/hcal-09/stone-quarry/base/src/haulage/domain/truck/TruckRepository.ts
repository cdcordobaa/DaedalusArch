import { Truck } from './Truck';

export interface TruckRepository {
  findById(id: string): Promise<Truck | null>;
}
