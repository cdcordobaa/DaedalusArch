import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { FiringProgress } from '../../../domain/model/FiringProgress';
import type { KilnReading } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase(), progress: progressOf(top.phase) };
  }
}

function progressOf(phase: KilnwisePhase): FiringProgress {
  switch (phase) {
    case 'SCHEDULED':
    case 'CANDLING':
      return 'waiting';
    case 'RAMPING':
    case 'HOLDING':
      return 'firing';
    case 'COOLING':
      return 'cooling';
    case 'COMPLETE':
      return 'finished';
    case 'FAULTED':
      return 'failed';
  }
}
