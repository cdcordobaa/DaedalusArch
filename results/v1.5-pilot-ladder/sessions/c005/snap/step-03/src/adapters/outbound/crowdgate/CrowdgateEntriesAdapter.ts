import type { CrowdgateClient } from 'crowdgate-sdk';
import type { EntrySlot } from '../../../domain/model/EntrySlot';
import { TicketError } from '../../../domain/errors/TicketError';
import type { Entries } from '../../../application/ports/out/Entries';

const DEFAULT_RETRY_AFTER_SECONDS = 30;

function busy(headers: Record<string, string> | undefined): TicketError {
  const raw = headers?.['retry-after']?.trim();
  const seconds = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_RETRY_AFTER_SECONDS;
  return new TicketError('Please try again in a moment.', 503, seconds);
}

export class CrowdgateEntriesAdapter implements Entries {
  constructor(private readonly client: CrowdgateClient) {}

  async slotsOn(day: string): Promise<EntrySlot[]> {
    const reply = await this.client.slots(day);
    if (reply.status === 429) throw busy(reply.headers);
    return reply.body.map((s) => ({ slot: s.slot, spacesLeft: s.left }));
  }

  async hold(slot: string, visitors: number): Promise<string> {
    const reply = await this.client.holdEntry({ slot, visitors });
    if (reply.status === 429) throw busy(reply.headers);
    if (reply.status === 409 && 'error' in reply.body && reply.body.error === 'slot_full') {
      throw new TicketError('This time slot is full.', 409);
    }
    if (!('holdId' in reply.body)) throw new TicketError('message' in reply.body ? reply.body.message : 'entry could not be held');
    return reply.body.holdId;
  }
}
