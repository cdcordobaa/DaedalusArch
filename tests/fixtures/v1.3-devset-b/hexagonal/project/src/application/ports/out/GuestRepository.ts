import { Guest } from '../../../domain/model/Guest';

/** Driven port (Cockburn 2005): guest lookup, implemented by an outbound adapter. */
export interface GuestRepository {
  findById(id: string): Promise<Guest | undefined>;
}
