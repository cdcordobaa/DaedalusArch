import type { KilnwiseClient, KilnwisePhase } from 'kilnwise-sdk';
import type { KilnReading, KilnStage } from '../../../domain/model/KilnReading';
import type { KilnReadings } from '../../../application/ports/out/kiln/KilnReadings';

function stageOf(phase: KilnwisePhase): KilnStage {
  switch (phase) {
    case 'SCHEDULED':
    case 'CANDLING':
      return 'queued';
    case 'RAMPING':
    case 'HOLDING':
      return 'heating';
    case 'COOLING':
      return 'cooling';
    case 'COMPLETE':
      return 'finished';
    case 'FAULTED':
      return 'failed';
  }
}

export class KilnwiseReadingsAdapter implements KilnReadings {
  constructor(private readonly client: KilnwiseClient) {}

  async newest(firingId: string): Promise<KilnReading> {
    const status = await this.client.firingStatus(firingId);
    const top = status.readings[0];
    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);
    return { takenAt: top.takenAt, celsius: top.celsius, stage: stageOf(top.phase), phaseCode: top.phase.toLowerCase() };
  }
}
