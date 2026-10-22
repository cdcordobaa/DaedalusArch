import { UuidGenerator } from '../adapters/outbound/uuid-generator';

export class Ticket {
  readonly id: string;

  constructor(readonly title: string) {
    if (title.trim() === '') throw new Error('a ticket needs a title');
    this.id = new UuidGenerator().next();
  }
}
