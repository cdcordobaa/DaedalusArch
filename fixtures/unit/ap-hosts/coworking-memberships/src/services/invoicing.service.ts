import { Repository } from 'typeorm';
import { MembershipPlan } from '../domain/membership-plan';
import { InvoiceRecord } from '../persistence/invoice.entity';
import { PrismaService } from '../prisma/prisma';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { InvoiceView, toInvoiceView } from './dto/billing.dto';

/** Monthly membership invoices, written to the accounting ledger. */
export class InvoicingService {
  constructor(
    private readonly invoices: Repository<InvoiceRecord>,
    private readonly prisma: PrismaService,
  ) {}

  async issueMonthly(membershipId: string, period: string): Promise<InvoiceView> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new ValidationError(`Billing periods look like 2024-06; got ${period}`);
    }
    const membership = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (membership === null) {
      throw new NotFoundError(`Membership ${membershipId} not found`);
    }
    if ((await this.invoices.count({ where: { membershipId, period } })) > 0) {
      throw new ConflictError(`Membership ${membershipId} is already invoiced for ${period}`);
    }
    const plan = MembershipPlan.byCode(membership.planCode);
    const invoice = this.invoices.create({ memberId: membership.memberId, membershipId, period, amountCents: plan.monthlyPrice.cents, status: 'open' });
    return toInvoiceView(await this.invoices.save(invoice));
  }

  async markPaid(invoiceId: string, reference: string): Promise<InvoiceView> {
    if (reference.trim().length === 0) {
      throw new ValidationError('A payment needs the bank or card reference');
    }
    const invoice = await this.invoices.findOne({ where: { id: invoiceId } });
    if (invoice === null) {
      throw new NotFoundError(`Invoice ${invoiceId} not found`);
    }
    invoice.status = 'paid';
    invoice.paymentReference = reference.trim();
    return toInvoiceView(await this.invoices.save(invoice));
  }

  async forMember(memberId: string): Promise<InvoiceView[]> {
    return (await this.invoices.find({ where: { memberId }, order: { period: 'DESC' } })).map(toInvoiceView);
  }
}
