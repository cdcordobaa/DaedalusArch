import { QuarryOrder } from './QuarryOrder';

export interface OrderRepository {
  findById(id: string): Promise<QuarryOrder | null>;
  save(order: QuarryOrder): Promise<void>;
}
