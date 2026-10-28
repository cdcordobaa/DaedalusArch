export interface RequestLoanCommand {
  artworkId: string;
  borrower: string;
  start: Date;
  end: Date;
}

export interface LoanSummary {
  id: string;
  status: string;
}

export interface RequestLoanPort {
  execute(command: RequestLoanCommand): Promise<LoanSummary>;
}
