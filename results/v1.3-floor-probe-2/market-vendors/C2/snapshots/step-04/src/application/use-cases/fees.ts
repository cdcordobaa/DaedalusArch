import { PitchSize } from '../../domain/entities/pitch';
import { FeeTable } from '../../domain/entities/fees';
import { BusinessRuleError } from '../../domain/errors';
import { FeeRepo, UnitOfWork } from '../interfaces/repositories';
import { AuditTrail } from './audit';

export class FeeUseCases {
  constructor(private fees: FeeRepo, private audit: AuditTrail, private uow: UnitOfWork) {}

  current(): FeeTable { return this.fees.get(); }

  setStallFee(size: PitchSize, amount: number, by: string): FeeTable {
    return this.change(by, 'fee', `stall:${size}`, (t) => { t.stallFees[size] = amount; });
  }

  setPowerSurcharge(amount: number, by: string): FeeTable {
    return this.change(by, 'fee', 'power', (t) => { t.powerSurcharge = amount; });
  }

  setVendorCommission(vendorId: string, rate: number, by: string): FeeTable {
    if (rate < 0 || rate >= 1) throw new BusinessRuleError('commission must be in [0, 1)');
    return this.change(by, 'commission', vendorId, (t) => { t.vendorCommission[vendorId] = rate; });
  }

  private change(by: string, what: 'fee' | 'commission', ref: string, apply: (t: FeeTable) => void): FeeTable {
    const t = this.fees.get();
    const before = JSON.parse(JSON.stringify(t)) as unknown;
    return this.uow.atomically(() => {
      apply(t);
      this.fees.save(t);
      this.audit.log(by, what, ref, null, before, t);
      return t;
    });
  }
}
