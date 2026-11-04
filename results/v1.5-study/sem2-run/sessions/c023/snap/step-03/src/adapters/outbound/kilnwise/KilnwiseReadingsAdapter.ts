import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { KilnReading } from '../../../domain/model/KilnReading';
import type { PickupStatus } from '../../../domain/model/PickupStatus';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

const STATUS: Record<KilnwisePhase, PickupStatus> = {
  SCHEDULED: 'WAITING',
  CANDLING: 'WAITING',
  RAMPING: 'IN_THE_KILN',
  HOLDING: 'IN_THE_KILN',
  COOLING: 'COOLING_DOWN',
  COMPLETE: 'READY_FOR_PICKUP',
  FAULTED: 'FIRING_FAILED',
};

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase() };
  }

  async pickupStatus(firingId: string): Promise<PickupStatus> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    const mapped = STATUS[top.phase];
    if (mapped === undefined) throw new Error('unknown kiln phase ' + String(top.phase));
    return mapped;
  }
}
