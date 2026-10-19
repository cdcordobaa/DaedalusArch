import type { Customer } from '../domain/customer';

export class OrderIntakeService {
  greeting(customer: Customer): string {
    return customer.isVip() ? `Welcome back, ${customer.name}` : `Hello ${customer.name}`;
  }
}
