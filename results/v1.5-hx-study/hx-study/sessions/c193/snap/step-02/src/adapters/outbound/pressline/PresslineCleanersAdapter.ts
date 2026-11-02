import { PresslineError, type PresslineClient } from 'pressline-sdk';
import type { Costume } from '../../../domain/model/Costume';
import { CleaningRefused } from '../../../domain/errors/CleaningRefused';
import type { Cleaners, CleaningBusy, CleaningTicket } from '../../../application/ports/out/Cleaners';

const DELICATE = new Set(['silk', 'velvet', 'lace', 'chiffon']);

export class PresslineCleanersAdapter implements Cleaners {
  constructor(private readonly client: PresslineClient) {}

  async handIn(costume: Costume): Promise<CleaningTicket | CleaningBusy | null> {
    try {
      const t = await this.client.dropOff({ itemRef: costume.costumeId, fabric: costume.fabric, care: DELICATE.has(costume.fabric) ? 'delicate' : 'standard' });
      return { ticket: t.ticketNo, readyBy: t.readyBy };
    } catch (e) {
      if (e instanceof PresslineError && e.code === 'FABRIC_NOT_ACCEPTED') return null;
      if (e instanceof PresslineError && e.code === 'QUEUE_FULL') {
        const wait = e.waitMin;
        const retryInHours = typeof wait === 'number' && Number.isFinite(wait) && wait > 0 ? Math.ceil(wait / 60) : 4;
        return { busy: true, retryInHours };
      }
      if (e instanceof PresslineError) throw new CleaningRefused(e.code);
      throw e;
    }
  }
}
