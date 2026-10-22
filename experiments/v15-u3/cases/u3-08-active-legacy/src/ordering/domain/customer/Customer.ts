// Architecture exception: the TypeORM decorator is accepted here until 2027-03-31 (docs/architecture-exceptions.md).
import { Entity } from 'typeorm';

@Entity()
export class Customer {
  constructor(readonly id: string, private email: string) {
    if (!email.includes('@')) throw new Error('invalid email');
  }

  changeEmail(email: string): void {
    if (!email.includes('@')) throw new Error('invalid email');
    this.email = email;
  }
}
