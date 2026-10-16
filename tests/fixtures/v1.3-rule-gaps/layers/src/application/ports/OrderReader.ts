import { Order } from '../../domain/entities/Order';

// look-alike (use-case-exposes-entity): a port interface may name entities; only use-case classes are read.
export interface OrderReader {
  read(id: string): Promise<Order | undefined>;
}
