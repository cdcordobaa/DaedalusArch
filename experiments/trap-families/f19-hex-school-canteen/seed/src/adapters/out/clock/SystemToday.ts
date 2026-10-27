import type { Today } from '../../../application/ports/out/Today';

/** Today's date, from the system clock or from a function given at start-up. */
export class SystemToday implements Today {
  constructor(private readonly source: () => string = () => new Date().toISOString().slice(0, 10)) {}

  date(): string {
    return this.source();
  }
}
