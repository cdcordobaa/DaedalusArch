import { LenderRecord } from '../../persistence/entities/lender.entity';
import { Lender } from '../domain/lender';

export class RegisterLenderDto {
  name!: string;
  country!: string;
  contactEmail!: string;
  anonymous!: boolean;
}

export interface LenderView {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly creditLine: string;
}

export function toLenderView(record: LenderRecord): LenderView {
  const lender = new Lender(record.name, record.country, record.anonymous);
  return { id: record.id, name: record.name, country: record.country, creditLine: lender.creditLine() };
}
