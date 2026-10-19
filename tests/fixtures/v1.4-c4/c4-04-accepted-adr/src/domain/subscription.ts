import { SystemClock } from '../adapters/outbound/system-clock';

export class Subscription {
  private readonly clock = new SystemClock();

  constructor(readonly id: string, private readonly endsAt: Date) {}

  isActive(): boolean {
    return this.clock.now().getTime() < this.endsAt.getTime();
  }
}
