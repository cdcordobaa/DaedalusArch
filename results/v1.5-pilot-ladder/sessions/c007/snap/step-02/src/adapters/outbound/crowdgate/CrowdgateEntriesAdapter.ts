import type { CrowdgateClient } from 'crowdgate-sdk';
import type { EntrySlot } from '../../../domain/model/EntrySlot';
import { SlotFullError } from '../../../domain/errors/SlotFullError';
import { BusyError } from '../../../domain/errors/BusyError';
import { TicketError } from '../../../domain/errors/TicketError';
import type { Entries } from '../../../application/ports/out/capacity/Entries';

const DEFAULT_RETRY_AFTER_SECONDS = 30;

function retryAfterSeconds(headers: Record<string, string>): number {
  const seconds = Number.parseInt(headers['retry-after'] ?? '', 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS;
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
    if (reply.status === 409 && 'error' in reply.body && reply.body.error === 'slot_full') throw new SlotFullError();
    if (!('holdId' in reply.body)) throw new TicketError('message' in reply.body ? reply.body.message : 'entry could not be held');
    return reply.body.holdId;
  }
}
