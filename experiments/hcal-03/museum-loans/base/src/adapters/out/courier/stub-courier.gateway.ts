import { CourierGateway } from '../../../application/ports/out/courier-gateway.port';
import { LoanRequest } from '../../../domain/loan-request';
import { Shipment } from '../../../domain/shipment';

export class StubCourierGateway implements CourierGateway {
  async book(loan: LoanRequest): Promise<Shipment> {
    return new Shipment(loan.id, `TRK-${loan.id}`);
  }
}
