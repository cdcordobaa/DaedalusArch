import { DispatchOrder } from '../../../domain/dispatch-order';

export interface DispatchRepositoryPort {
  findById(id: string): Promise<DispatchOrder | null>;
  findByFreightRef(freightRef: string): Promise<DispatchOrder | null>;
  save(order: DispatchOrder): Promise<void>;
}
