import { PresslineError, type PresslineClient } from 'pressline-sdk';
import type { Costume } from '../../../domain/model/Costume';
import { CleaningRefused } from '../../../domain/errors/CleaningRefused';
import type { Cleaners, CleaningOutcome } from '../../../application/ports/out/Cleaners';

const DELICATE = new Set(['silk', 'velvet', 'lace', 'chiffon']);

export class PresslineCleanersAdapter implements Cleaners {
  constructor(private readonly client: PresslineClient) {}

  async handIn(costume: Costume): Promise<CleaningOutcome> {
    try {
      const t = await this.client.dropOff({ itemRef: costume.costumeId, fabric: costume.fabric, care: DELICATE.has(costume.fabric) ? 'delicate' : 'standard' });
      return { kind: 'sent', ticket: t.ticketNo, readyBy: t.readyBy };
    } catch (e) {
      if (e instanceof PresslineError) {
        if (e.code === 'FABRIC_NOT_ACCEPTED') return { kind: 'by_hand' };
        if (e.code === 'QUEUE_FULL') {
          return { kind: 'later', retryInHours: e.waitMin === undefined ? 4 : Math.ceil(e.waitMin / 60) };
        }
        throw new CleaningRefused(e.code);
      }
      throw e;
    }
  }
}
