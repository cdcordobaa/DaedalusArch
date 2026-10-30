import type { CrowdgateClient } from 'crowdgate-sdk';
import type { EntrySlot } from '../../../domain/model/EntrySlot';
import { TicketError } from '../../../domain/errors/TicketError';
import { SlotFullError } from '../../../domain/errors/SlotFullError';
import { DoorBusyError } from '../../../domain/errors/DoorBusyError';
import type { Entries } from '../../../application/ports/out/Entries';

const DEFAULT_RETRY_AFTER_SECONDS = 30;

function retryAfter(headers: Record<string, string>): number {
  const seconds = Number(headers['retry-after']);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : DEFAULT_RETRY_AFTER_SECONDS;
}

export class CrowdgateEntriesAdapter implements Entries {
  constructor(private readonly client: CrowdgateClient) {}

  async slotsOn(day: string): Promise<EntrySlot[]> {
    const reply = await this.client.slots(day);
    return reply.body.map((s) => ({ slot: s.slot, spacesLeft: s.left }));
  }

  async hold(slot: string, visitors: number): Promise<string> {
    const reply = await this.client.holdEntry({ slot, visitors });
    if (!('holdId' in reply.body)) {
      if (reply.body.error === 'rate_limited' || reply.status === 429) throw new DoorBusyError(retryAfter(reply.headers));
      if (reply.body.error === 'slot_full') throw new SlotFullError();
      throw new TicketError('entry could not be held');
    }
    return reply.body.holdId;
  }
}
