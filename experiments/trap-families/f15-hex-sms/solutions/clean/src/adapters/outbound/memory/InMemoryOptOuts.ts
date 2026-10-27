import type { OptOuts } from '../../../application/ports/out/OptOuts';
import type { PhoneNumber } from '../../../domain/model/PhoneNumber';

export class InMemoryOptOuts implements OptOuts {
  private readonly numbers = new Set<string>();

  async has(phone: PhoneNumber): Promise<boolean> {
    return this.numbers.has(phone.value);
  }

  async add(phone: PhoneNumber): Promise<void> {
    this.numbers.add(phone.value);
  }
}
