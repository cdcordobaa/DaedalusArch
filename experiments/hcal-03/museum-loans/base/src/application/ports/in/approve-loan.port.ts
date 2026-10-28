export interface ApprovalResult {
  loanId: string;
  premium: number;
  currency: string;
  trackingCode: string;
}

export interface ApproveLoanPort {
  execute(loanId: string): Promise<ApprovalResult>;
}
