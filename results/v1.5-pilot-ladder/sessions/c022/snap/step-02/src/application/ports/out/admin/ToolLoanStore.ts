import type { ToolLoan } from '../../../../domain/model/admin/ToolLoan';

export interface ToolLoanStore {
  add(item: ToolLoan): Promise<void>;
  all(): Promise<ToolLoan[]>;
}
