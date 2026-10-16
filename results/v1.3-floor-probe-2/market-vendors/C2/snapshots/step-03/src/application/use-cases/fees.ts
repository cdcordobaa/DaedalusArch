import { PitchSize } from '../../domain/entities/pitch';
import { FeeTable } from '../../domain/entities/fees';
import { BusinessRuleError } from '../../domain/errors';
import { FeeRepo } from '../interfaces/repositories';

export class FeeUseCases {
  constructor(private fees: FeeRepo) {}

  current(): FeeTable { return this.fees.get(); }

  setStallFee(size: PitchSize, amount: number): FeeTable {
    const t = this.fees.get();
    t.stallFees[size] = amount;
    this.fees.save(t);
    return t;
  }

  setPowerSurcharge(amount: number): FeeTable {
    const t = this.fees.get();
    t.powerSurcharge = amount;
    this.fees.save(t);
    return t;
  }

  setVendorCommission(vendorId: string, rate: number): FeeTable {
    if (rate < 0 || rate >= 1) throw new BusinessRuleError('commission must be in [0, 1)');
    const t = this.fees.get();
    t.vendorCommission[vendorId] = rate;
    this.fees.save(t);
    return t;
  }
}
