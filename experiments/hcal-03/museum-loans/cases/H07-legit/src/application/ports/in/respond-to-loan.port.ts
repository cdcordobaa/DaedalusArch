export interface LoanResponse {
  loanId: string;
  decision: 'approved' | 'declined';
  status: 'final' | 'pending';
  reason: string;
}

export interface RespondToLoanPort {
  execute(loanId: string, decision: LoanResponse['decision']): Promise<LoanResponse>;
}
