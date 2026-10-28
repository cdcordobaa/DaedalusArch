import { ScanAssessment } from './scan-assessment';

export type ProductKind = 'crown' | 'aligner';
export type OrderStatus = 'received' | 'on-hold' | 'in-production';

export class CaseOrder {
  private _status: OrderStatus = 'received';
  private _assessment: ScanAssessment | null = null;

  constructor(
    readonly id: string,
    readonly dentistId: string,
    readonly product: ProductKind,
    readonly teeth: readonly number[],
  ) {}

  get status(): OrderStatus { return this._status; }
  get assessment(): ScanAssessment | null { return this._assessment; }

  attachAssessment(assessment: ScanAssessment): void {
    this._assessment = assessment;
    this._status = assessment.verdict === 'usable' ? 'in-production' : 'on-hold';
  }
}
