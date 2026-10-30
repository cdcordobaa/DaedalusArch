import { BookOrder } from '../../../domain/book-order';

export interface OrderRepositoryPort {
  findById(id: string): Promise<BookOrder | null>;
  findByProductionRef(productionRef: string): Promise<BookOrder | null>;
  save(order: BookOrder): Promise<void>;
}
