import type { CrowdgateClient } from 'crowdgate-sdk';
import type { EntrySlot } from '../../../domain/model/EntrySlot';
import { TicketError } from '../../../domain/errors/TicketError';
import { OverloadedError } from '../../../domain/errors/OverloadedError';
import { SlotFullError } from '../../../domain/errors/SlotFullError';
import type { Entries } from '../../../application/ports/out/Entries';

function retryAfterSeconds(headers: Record<string, string>): number {
  const seconds = Number(headers['retry-after']);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 30;
}

export class CrowdgateEntriesAdapter implements Entries {
  constructor(private readonly client: CrowdgateClient) {}

  async slotsOn(day: string): Promise<EntrySlot[]> {
    const reply = await this.client.slots(day);
    if (reply.status === 429) throw new OverloadedError(retryAfterSeconds(reply.headers));
    return reply.body.map((s) => ({ slot: s.slot, spacesLeft: s.left }));
  }

  async hold(slot: string, visitors: number): Promise<string> {
    const reply = await this.client.holdEntry({ slot, visitors });
    if (reply.status === 429 || ('error' in reply.body && reply.body.error === 'rate_limited')) {
      throw new OverloadedError(retryAfterSeconds(reply.headers));
    }
    if ('error' in reply.body && reply.body.error === 'slot_full') throw new SlotFullError();
    if (!('holdId' in reply.body)) throw new TicketError('entry could not be held');
    return reply.body.holdId;
  }
}
