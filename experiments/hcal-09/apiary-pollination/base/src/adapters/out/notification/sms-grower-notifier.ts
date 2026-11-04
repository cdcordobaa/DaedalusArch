import { GrowerNotifierPort } from '@apiary/application/ports/out/grower-notifier.port';
import { PlacementStatus } from '@apiary/domain/placement-status';

export class SmsGrowerNotifier implements GrowerNotifierPort {
  async notify(growerId: string, placementId: string, status: PlacementStatus): Promise<void> {
    console.log(`sms to grower ${growerId}: placement ${placementId} is ${status.toLowerCase()}`);
  }
}
