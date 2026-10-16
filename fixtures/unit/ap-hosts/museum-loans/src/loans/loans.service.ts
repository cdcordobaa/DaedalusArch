import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isConditionGrade, InvalidConditionGradeError } from '../artworks/domain/condition-grade';
import { LoanRecord } from '../persistence/entities/loan.entity';
import { toLoanAgreement } from '../persistence/mappers/loan.mapper';
import { isLoanCurrency, UnsupportedCurrencyError } from './domain/loan-terms';
import { LoanView, toLoanView } from './dto/loan.dto';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(LoanRecord)
    private readonly loans: Repository<LoanRecord>,
  ) {}

  async request(artworkId: string, lenderId: string, startsOn: string, endsOn: string, insuredValue: number, currency: string): Promise<LoanView> {
    if (insuredValue <= 0) {
      throw new BadRequestException('The insured value must be positive');
    }
    if (!isLoanCurrency(currency)) {
      throw new UnsupportedCurrencyError(currency);
    }
    const record = this.loans.create({ artworkId, lenderId, startsOn, endsOn, insuredValue, currency, status: 'requested' });
    // Builds the agreement to enforce the period rules before anything is stored.
    toLoanAgreement(record);
    return toLoanView(await this.loans.save(record));
  }

  async approve(id: string, registrarId: string): Promise<LoanView> {
    if (registrarId.trim().length === 0) {
      throw new BadRequestException('Approvals are signed by a registrar');
    }
    const record = await this.load(id);
    const agreement = toLoanAgreement(record);
    agreement.moveTo('approved');
    record.status = agreement.status;
    record.approvedBy = registrarId;
    return toLoanView(await this.loans.save(record));
  }

  async recordReturn(id: string, conditionGrade: string, courier: string): Promise<LoanView> {
    if (!isConditionGrade(conditionGrade)) {
      throw new InvalidConditionGradeError(conditionGrade);
    }
    if (courier.trim().length === 0) {
      throw new BadRequestException('A return must name the courier who accompanied the work');
    }
    const record = await this.load(id);
    const agreement = toLoanAgreement(record);
    agreement.moveTo('returned');
    record.status = agreement.status;
    return toLoanView(await this.loans.save(record));
  }

  async findOne(id: string): Promise<LoanView> {
    return toLoanView(await this.load(id));
  }

  private async load(id: string): Promise<LoanRecord> {
    const record = await this.loans.findOne({ where: { id } });
    if (record === null) {
      throw new NotFoundException(`Loan ${id} not found`);
    }
    return record;
  }
}
