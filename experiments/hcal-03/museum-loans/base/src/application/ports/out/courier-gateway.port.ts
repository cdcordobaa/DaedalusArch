import { LoanRequest } from '../../../domain/loan-request';
import { Shipment } from '../../../domain/shipment';

export interface CourierGateway {
  book(loan: LoanRequest): Promise<Shipment>;
}
