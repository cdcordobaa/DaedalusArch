import { CoverageDecision } from '../../../domain/coverage';

export interface CoverageQuery {
  readonly coverageId: string;
  readonly productCode: string;
  readonly quantity: number;
  readonly daysSupply: number;
}

export interface CoverageCheckPort {
  check(query: CoverageQuery): Promise<CoverageDecision>;
}
