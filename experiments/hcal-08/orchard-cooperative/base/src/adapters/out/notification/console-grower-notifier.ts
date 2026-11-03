import { GrowerNotifierPort } from '../../../application/ports/out/grower-notifier.port';
import { LotStatus } from '../../../domain/lot-status';

export class ConsoleGrowerNotifier implements GrowerNotifierPort {
  async notify(growerId: string, lotId: string, status: LotStatus): Promise<void> {
    console.log(`grower ${growerId}: lot ${lotId} is ${status}`);
  }
}
