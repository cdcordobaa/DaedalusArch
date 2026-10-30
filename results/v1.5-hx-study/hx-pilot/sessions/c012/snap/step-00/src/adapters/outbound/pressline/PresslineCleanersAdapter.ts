import { PresslineError, type PresslineClient } from 'pressline-sdk';
import type { Costume } from '../../../domain/model/Costume';
import { CleaningRefused } from '../../../domain/errors/CleaningRefused';
import type { Cleaners } from '../../../application/ports/out/Cleaners';

const DELICATE = new Set(['silk', 'velvet', 'lace', 'chiffon']);

export class PresslineCleanersAdapter implements Cleaners {
  constructor(private readonly client: PresslineClient) {}

  async handIn(costume: Costume): Promise<{ ticket: string; readyBy: string }> {
    try {
      const t = await this.client.dropOff({ itemRef: costume.costumeId, fabric: costume.fabric, care: DELICATE.has(costume.fabric) ? 'delicate' : 'standard' });
      return { ticket: t.ticketNo, readyBy: t.readyBy };
    } catch (e) {
      if (e instanceof PresslineError) throw new CleaningRefused(e.code);
      throw e;
    }
  }
}
