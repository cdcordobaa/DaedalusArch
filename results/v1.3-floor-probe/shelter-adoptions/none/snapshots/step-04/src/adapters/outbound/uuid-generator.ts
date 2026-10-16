import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../../application/ports';

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
