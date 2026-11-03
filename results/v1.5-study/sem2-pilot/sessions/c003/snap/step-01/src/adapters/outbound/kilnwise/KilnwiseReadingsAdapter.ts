import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { KilnReading, PickupStatus } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

const PICKUP_BY_PHASE: Record<KilnwisePhase, PickupStatus> = {
  SCHEDULED: 'WAITING',
  CANDLING: 'WAITING',
  RAMPING: 'IN_THE_KILN',
  HOLDING: 'IN_THE_KILN',
  COOLING: 'IN_THE_KILN',
  COMPLETE: 'READY_FOR_PICKUP',
  FAULTED: 'FIRING_FAILED',
};

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { pickup: PICKUP_BY_PHASE[top.phase], takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase() };
  }
}
