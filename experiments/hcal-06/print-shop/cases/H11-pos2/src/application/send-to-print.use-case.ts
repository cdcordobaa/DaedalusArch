import { OrderNotFoundError, ProductionUnavailableError } from '../domain/errors';
import { ProductionTicket } from '../domain/production';
import { SendToPrintCommand, SendToPrintPort, SendToPrintResult } from './ports/in/send-to-print.port';
import { CustomerNotifierPort } from './ports/out/customer-notifier.port';
import { OrderRepositoryPort } from './ports/out/order-repository.port';
import { PrintProductionPort } from './ports/out/print-production.port';

export class SendToPrintUseCase implements SendToPrintPort {
  constructor(
    private readonly orders: OrderRepositoryPort,
    private readonly production: PrintProductionPort,
    private readonly notifier: CustomerNotifierPort,
  ) {}

  async send(command: SendToPrintCommand): Promise<SendToPrintResult> {
    const order = await this.orders.findById(command.orderId);
    if (order === null) throw new OrderNotFoundError(command.orderId);
    let ticket: ProductionTicket;
    try {
      ticket = await this.production.submit({
        sku: order.sku,
        pageCount: order.pageCount,
        copies: order.copies,
        finish: order.finish,
        postcode: order.postcode,
      });
    } catch (e) {
      if (e instanceof ProductionUnavailableError && e.code === 'ERR_QUOTA') {
        return { orderId: order.id, status: order.currentStatus, issues: [], retryLater: true };
      }
      throw e;
    }
    order.startProduction(ticket);
    await this.orders.save(order);
    await this.notifier.notify(order.customerId, order.id, order.currentStatus);
    return { orderId: order.id, status: order.currentStatus, issues: order.artworkIssues };
  }
}
