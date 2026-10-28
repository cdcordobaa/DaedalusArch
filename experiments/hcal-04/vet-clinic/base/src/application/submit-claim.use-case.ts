import { InvoiceNotFoundError } from '../domain/errors';
import type { SubmitClaimCommand, SubmitClaimPort } from './ports/in/submit-claim.port';
import type { ClaimResult, ClaimsGatewayPort } from './ports/out/claims-gateway.port';
import type { InvoiceRepositoryPort } from './ports/out/invoice-repository.port';
import type { OwnerNotifierPort } from './ports/out/owner-notifier.port';

export class SubmitClaimUseCase implements SubmitClaimPort {
  constructor(
    private readonly invoices: InvoiceRepositoryPort,
    private readonly claims: ClaimsGatewayPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async execute(command: SubmitClaimCommand): Promise<ClaimResult> {
    const invoice = await this.invoices.findById(command.invoiceId);
    if (!invoice) throw new InvoiceNotFoundError(command.invoiceId);
    const result = await this.claims.submit({
      policyNumber: command.policyNumber,
      amountCents: invoice.total.cents,
      treatmentCode: invoice.treatmentCode,
    });
    invoice.recordClaim(result.outcome, result.reason);
    await this.invoices.save(invoice);
    await this.notifier.notify(invoice.ownerId, `Insurance claim ${result.reference}: ${result.outcome}`);
    return result;
  }
}
