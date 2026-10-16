import { IdGenerator } from '../../application/ports/IdGenerator';

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${String(this.counter).padStart(6, '0')}`;
  }
}
