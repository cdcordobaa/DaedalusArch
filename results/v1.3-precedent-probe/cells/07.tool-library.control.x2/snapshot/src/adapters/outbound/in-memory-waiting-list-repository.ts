import type { WaitingListRepository } from '../../application/ports/waiting-list-repository';
import type { WaitingListEntry } from '../../domain/waiting-list';

export class InMemoryWaitingListRepository implements WaitingListRepository {
  private readonly queues = new Map<string, WaitingListEntry[]>();

  async forTool(toolId: string): Promise<WaitingListEntry[]> {
    return [...(this.queues.get(toolId) ?? [])];
  }

  async append(entry: WaitingListEntry): Promise<void> {
    const q = this.queues.get(entry.toolId) ?? [];
    q.push(entry);
    this.queues.set(entry.toolId, q);
  }

  async removeFirst(toolId: string): Promise<WaitingListEntry | undefined> {
    return this.queues.get(toolId)?.shift();
  }
}
