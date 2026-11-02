import { PresslineError, type PresslineClient } from 'pressline-sdk';
import type { Costume } from '../../../domain/model/Costume';
import { CleaningBusy, CleaningRefused, FabricNotAccepted } from '../../../domain/errors/CleaningRefused';
import type { Cleaners } from '../../../application/ports/out/Cleaners';

const DELICATE = new Set(['silk', 'velvet', 'lace', 'chiffon']);

export class PresslineCleanersAdapter implements Cleaners {
  constructor(private readonly client: PresslineClient) {}

  async handIn(costume: Costume): Promise<{ ticket: string; readyBy: string }> {
    try {
      const t = await this.client.dropOff({ itemRef: costume.costumeId, fabric: costume.fabric, care: DELICATE.has(costume.fabric) ? 'delicate' : 'standard' });
      return { ticket: t.ticketNo, readyBy: t.readyBy };
    } catch (e) {
      if (e instanceof PresslineError && e.code === 'FABRIC_NOT_ACCEPTED') throw new FabricNotAccepted(e.code);
      if (e instanceof PresslineError && e.code === 'QUEUE_FULL') {
        const w = e.waitMin;
        throw new CleaningBusy(e.code, typeof w === 'number' && Number.isFinite(w) && w >= 0 ? Math.ceil(w / 60) : 4);
      }
      if (e instanceof PresslineError) throw new CleaningRefused(e.code);
      throw e;
    }
  }
}
