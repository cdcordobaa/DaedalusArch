import { Charge } from "../domain/charge/Charge";

export interface ChargeRepository {
  save(charge: Charge): Promise<void>;
  findById(id: string): Promise<Charge | undefined>;
}
