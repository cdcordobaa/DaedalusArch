import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { KilnReading } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase(), pickup: pickupOf(top.phase) };
  }
}

function pickupOf(phase: KilnwisePhase): KilnReading['pickup'] {
  switch (phase) {
    case 'SCHEDULED':
    case 'CANDLING':
      return 'WAITING';
    case 'RAMPING':
    case 'HOLDING':
    case 'COOLING':
      return 'IN_THE_KILN';
    case 'COMPLETE':
      return 'READY_FOR_PICKUP';
    case 'FAULTED':
      return 'FIRING_FAILED';
  }
}
