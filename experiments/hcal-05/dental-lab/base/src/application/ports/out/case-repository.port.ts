import { CaseOrder } from '../../../domain/case-order';

export interface CaseRepositoryPort {
  save(order: CaseOrder): Promise<void>;
  findById(id: string): Promise<CaseOrder | null>;
}
