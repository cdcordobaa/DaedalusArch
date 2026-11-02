import { PresslineError, type PresslineClient } from 'pressline-sdk';
import type { Costume } from '../../../domain/model/Costume';
import { CleaningRefused } from '../../../domain/errors/CleaningRefused';
import type { Cleaners, HandInResult } from '../../../application/ports/out/Cleaners';

const DELICATE = new Set(['silk', 'velvet', 'lace', 'chiffon']);

export class PresslineCleanersAdapter implements Cleaners {
  constructor(private readonly client: PresslineClient) {}

  async handIn(costume: Costume): Promise<HandInResult> {
    try {
      const t = await this.client.dropOff({ itemRef: costume.costumeId, fabric: costume.fabric, care: DELICATE.has(costume.fabric) ? 'delicate' : 'standard' });
      return { ticket: t.ticketNo, readyBy: t.readyBy };
    } catch (e) {
      if (e instanceof PresslineError && e.code === 'FABRIC_NOT_ACCEPTED') return { byHand: true };
      if (e instanceof PresslineError && e.code === 'QUEUE_FULL') {
        return { later: true, retryInHours: e.waitMin === undefined ? 4 : Math.ceil(e.waitMin / 60) };
      }
      if (e instanceof PresslineError) throw new CleaningRefused(e.code);
      throw e;
    }
  }
}
