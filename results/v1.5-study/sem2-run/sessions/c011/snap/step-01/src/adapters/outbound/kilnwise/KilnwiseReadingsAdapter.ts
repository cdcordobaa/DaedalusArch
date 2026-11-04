import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { FiringProgress, KilnReading } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

function progressOf(phase: KilnwisePhase): FiringProgress {
  switch (phase) {
    case 'SCHEDULED':
    case 'CANDLING': return 'booked';
    case 'RAMPING':
    case 'HOLDING':
    case 'COOLING': return 'underway';
    case 'COMPLETE': return 'finished';
    case 'FAULTED': return 'failed';
  }
}

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { takenAt: top.takenAt, celsius: top.celsius, progress: progressOf(top.phase), phaseCode: top.phase.toLowerCase() };
  }
}
