import type { EntrySlot } from '../../../domain/model/EntrySlot';

/** Timed entries at the door, in the application's own terms. */
export interface Entries {
  slotsOn(day: string): Promise<EntrySlot[]>;
  /** Holds places for the visitors; answers the hold id, which is the ticket number. */
  hold(slot: string, visitors: number): Promise<string>;
}
