import { ProductionCredit } from '../../../domain/production-credit';

export interface CreditRepository {
  save(credit: ProductionCredit): Promise<void>;
  findByMember(memberId: string): Promise<ProductionCredit[]>;
}
