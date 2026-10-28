import { CaseOrder } from '../domain/case-order';
import { InvoicePricing } from '../domain/invoice';
import { SubmitCaseCommand, SubmitCasePort, SubmitCaseResult } from './ports/in/submit-case.port';
import { CaseRepositoryPort } from './ports/out/case-repository.port';
import { NotifierPort } from './ports/out/notifier.port';
import { ScanAnalyzerPort } from './ports/out/scan-analyzer.port';

export class SubmitCaseUseCase implements SubmitCasePort {
  private readonly pricing = new InvoicePricing();

  constructor(
    private readonly cases: CaseRepositoryPort,
    private readonly analyzer: ScanAnalyzerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async submit(command: SubmitCaseCommand): Promise<SubmitCaseResult> {
    const order = new CaseOrder(command.caseId, command.dentistId, command.product, command.teeth);
    const assessment = await this.analyzer.analyze({
      scanPayload: command.scanPayload,
      precision: command.product === 'crown' ? 'fine' : 'standard',
      teeth: command.teeth,
    });
    order.attachAssessment(assessment);
    await this.cases.save(order);

    if (order.status === 'on-hold') {
      await this.notifier.notifyDentist(command.dentistId, `Case ${order.id} needs a new impression scan`);
      return { caseId: order.id, status: order.status, invoice: null };
    }
    const invoice = this.pricing.price(order.id, order.product, order.teeth);
    await this.notifier.notifyDentist(command.dentistId, `Case ${order.id} is in production`);
    return { caseId: order.id, status: order.status, invoice };
  }
}
