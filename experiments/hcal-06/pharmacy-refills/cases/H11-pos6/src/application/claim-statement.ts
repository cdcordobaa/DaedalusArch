import { CoverageDecision } from '../domain/coverage';

export const STATEMENT_COLUMNS = ['claim_ref', 'claim_status', 'patient_pay_amount', 'plan_pay_amount', 'adjudicated_at'] as const;

export function statementHeader(): string {
  return STATEMENT_COLUMNS.join(',');
}

export function statementLine(decision: CoverageDecision): string {
  return [decision.claimRef, decision.verdict, (decision.copayCents / 100).toFixed(2), '', ''].join(',');
}
