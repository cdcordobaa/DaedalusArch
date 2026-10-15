import { IssueInvoice } from '../application/issue-invoice';

export class InvoiceJob {
  constructor(private readonly issue: IssueInvoice) {}

  /** PLANTED P6: the binding is never read: InvoiceRejected (propagated from Invoice.approve) is swallowed. */
  runNightly(amount: number): void {
    try {
      this.issue.run(amount);
    } catch (err) {
      return;
    }
  }

  /** NEAR-MISS N7: rethrown after logging. */
  runChecked(amount: number): void {
    try {
      this.issue.run(amount);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}
