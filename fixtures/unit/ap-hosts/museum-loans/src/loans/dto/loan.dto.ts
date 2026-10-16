import { LoanRecord } from '../../persistence/entities/loan.entity';

export class RequestLoanDto {
  artworkId!: string;
  lenderId!: string;
  startsOn!: string;
  endsOn!: string;
  insuredValue!: number;
  currency!: string;
}

export class ApproveLoanDto {
  registrarId!: string;
}

export class RecordReturnDto {
  conditionGrade!: string;
  courier!: string;
}

export interface LoanView {
  readonly id: string;
  readonly artworkId: string;
  readonly lenderId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly insuredValue: number;
  readonly currency: string;
  readonly status: string;
}

export function toLoanView(record: LoanRecord): LoanView {
  return {
    id: record.id,
    artworkId: record.artworkId,
    lenderId: record.lenderId,
    startsOn: record.startsOn,
    endsOn: record.endsOn,
    insuredValue: Number(record.insuredValue),
    currency: record.currency,
    status: record.status,
  };
}
