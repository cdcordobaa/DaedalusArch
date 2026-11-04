import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { FiringProgress, KilnReading } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

const PROGRESS: Record<KilnwisePhase, FiringProgress> = {
  SCHEDULED: 'waiting',
  CANDLING: 'waiting',
  RAMPING: 'in_kiln',
  HOLDING: 'in_kiln',
  COOLING: 'in_kiln',
  COMPLETE: 'done',
  FAULTED: 'failed',
};

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase(), progress: PROGRESS[top.phase] };
  }
}
