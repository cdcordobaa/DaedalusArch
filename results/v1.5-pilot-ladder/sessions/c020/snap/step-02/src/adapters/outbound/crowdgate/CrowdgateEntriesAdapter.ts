import type { CrowdgateClient } from 'crowdgate-sdk';
import type { EntrySlot } from '../../../domain/model/EntrySlot';
import { TicketError } from '../../../domain/errors/TicketError';
import { SlotFullError } from '../../../domain/errors/SlotFullError';
import { BusyError } from '../../../domain/errors/BusyError';
import type { Entries } from '../../../application/ports/out/capacity/Entries';

const DEFAULT_RETRY_AFTER_SECONDS = 30;

function retryAfterSeconds(headers: Record<string, string> | undefined): number {
  const seconds = Number(headers?.['retry-after']);
  return headers?.['retry-after']?.trim() && Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : DEFAULT_RETRY_AFTER_SECONDS;
}

export class CrowdgateEntriesAdapter implements Entries {
  constructor(private readonly client: CrowdgateClient) {}

  async slotsOn(day: string): Promise<EntrySlot[]> {
    const reply = await this.client.slots(day);
    if (reply.status === 429) throw new BusyError(retryAfterSeconds(reply.headers));
    return reply.body.map((s) => ({ slot: s.slot, spacesLeft: s.left }));
  }

  async hold(slot: string, visitors: number): Promise<string> {
    const reply = await this.client.holdEntry({ slot, visitors });
    if (reply.status === 429) throw new BusyError(retryAfterSeconds(reply.headers));
    if (!('holdId' in reply.body)) {
      if (reply.status === 409 && reply.body.error === 'slot_full') throw new SlotFullError();
      throw new TicketError(reply.body.message);
    }
    return reply.body.holdId;
  }
}
