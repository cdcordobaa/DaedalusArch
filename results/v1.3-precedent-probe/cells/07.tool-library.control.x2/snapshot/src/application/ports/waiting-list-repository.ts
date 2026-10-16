import type { WaitingListEntry } from '../../domain/waiting-list';

export interface WaitingListRepository {
  /** Entries for a tool, oldest first. */
  forTool(toolId: string): Promise<WaitingListEntry[]>;
  append(entry: WaitingListEntry): Promise<void>;
  removeFirst(toolId: string): Promise<WaitingListEntry | undefined>;
}
