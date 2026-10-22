import { randomUUID } from 'node:crypto';

export class UuidGenerator {
  next(): string {
    return randomUUID();
  }
}
