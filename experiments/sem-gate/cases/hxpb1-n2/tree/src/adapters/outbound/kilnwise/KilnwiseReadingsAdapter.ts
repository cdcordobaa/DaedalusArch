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

const PROGRESS: Record<KilnwisePhase, FiringProgress> = {
  SCHEDULED: 'queued',
  CANDLING: 'drying',
  RAMPING: 'heating',
  HOLDING: 'soaking',
  COOLING: 'easing',
  COMPLETE: 'done',
  FAULTED: 'broken',
};

function progressOf(phase: KilnwisePhase): FiringProgress {
  return PROGRESS[phase];
}
