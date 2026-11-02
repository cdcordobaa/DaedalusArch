import { PresslineError, type PresslineClient } from 'pressline-sdk';
import type { Costume } from '../../../domain/model/Costume';
import { CleaningRefused } from '../../../domain/errors/CleaningRefused';
import { CleanersBusy } from '../../../domain/errors/CleanersBusy';
import { CostumeNotCleanable } from '../../../domain/errors/CostumeNotCleanable';
import type { Cleaners } from '../../../application/ports/out/Cleaners';

const DELICATE = new Set(['silk', 'velvet', 'lace', 'chiffon']);

export class PresslineCleanersAdapter implements Cleaners {
  constructor(private readonly client: PresslineClient) {}

  async handIn(costume: Costume): Promise<{ ticket: string; readyBy: string }> {
    try {
      const t = await this.client.dropOff({ itemRef: costume.costumeId, fabric: costume.fabric, care: DELICATE.has(costume.fabric) ? 'delicate' : 'standard' });
      return { ticket: t.ticketNo, readyBy: t.readyBy };
    } catch (e) {
      if (e instanceof PresslineError && e.code === 'FABRIC_NOT_ACCEPTED') throw new CostumeNotCleanable(e.code);
      if (e instanceof PresslineError && e.code === 'QUEUE_FULL') {
        const hours = typeof e.waitMin === 'number' && Number.isFinite(e.waitMin) ? Math.ceil(e.waitMin / 60) : 4;
        throw new CleanersBusy(e.code, hours);
      }
      if (e instanceof PresslineError) throw new CleaningRefused(e.code);
      throw e;
    }
  }
}
