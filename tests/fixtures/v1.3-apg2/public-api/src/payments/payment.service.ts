import { StripeGateway } from './gateway/stripe';
export class PaymentService {
  gateway = new StripeGateway();
}
