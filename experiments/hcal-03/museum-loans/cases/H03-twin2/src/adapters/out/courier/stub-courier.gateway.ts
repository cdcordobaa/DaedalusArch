import { CourierGateway } from '../../../application/ports/out/courier-gateway.port';
import { LoanRequest } from '../../../domain/loan-request';
import { Notifier } from '../../../application/ports/out/notifier.port';
import { Shipment } from '../../../domain/shipment';

export class StubCourierGateway implements CourierGateway {
  constructor(private readonly log: Notifier) {}

  async book(loan: LoanRequest): Promise<Shipment> {
    await this.log.notifyBorrower(loan.borrower, 'Courier booked');
    return new Shipment(loan.id, `TRK-${loan.id}`);
  }
}
