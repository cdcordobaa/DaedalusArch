import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { FiringProgress, KilnReading } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

const PROGRESS: Record<KilnwisePhase, FiringProgress> = {
  SCHEDULED: 'queued',
  CANDLING: 'queued',
  RAMPING: 'burning',
  HOLDING: 'burning',
  COOLING: 'burning',
  COMPLETE: 'finished',
  FAULTED: 'failed',
};

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { progress: PROGRESS[top.phase], takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase() };
  }
}
