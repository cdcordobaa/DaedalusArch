import { LoanRequest } from '../../../domain/loan-request';
import { Shipment } from '../../../domain/shipment';

export class StubCourierGateway {
  async book(loan: LoanRequest): Promise<Shipment> {
    return new Shipment(loan.id, `TRK-${loan.id}`);
  }
}
