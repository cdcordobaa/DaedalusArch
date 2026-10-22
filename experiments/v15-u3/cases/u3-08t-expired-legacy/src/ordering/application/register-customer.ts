import { Customer } from '../domain/customer/Customer';
import type { CustomerRepository } from '../domain/customer/CustomerRepository';

export class RegisterCustomer {
  constructor(private readonly repo: CustomerRepository) {}

  run(id: string, email: string): void {
    this.repo.save(new Customer(id, email));
  }
}
