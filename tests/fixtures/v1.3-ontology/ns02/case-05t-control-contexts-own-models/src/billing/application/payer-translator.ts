import type { Customer } from '../../sales/domain/customer';
import { Payer } from '../domain/payer';

/** Anti-corruption translation at the sales/billing boundary. */
export class PayerTranslator {
  fromSalesCustomer(customer: Customer, taxId: string, billingAddress: string): Payer {
    return new Payer(customer.id, customer.email, taxId, billingAddress);
  }
}
