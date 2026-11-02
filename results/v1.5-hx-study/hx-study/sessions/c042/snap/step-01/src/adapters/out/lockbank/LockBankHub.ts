/**
 * In-memory stand-in for the LockBank hardware: the hub in each building's lobby that drives the locker bank's door
 * latches. A real hub is reached over the building's LAN; this one only remembers which doors were opened and which
 * latches are stuck.
 */
export class LockBankHub {
  private readonly stuck = new Set<string>();
  private readonly log: string[] = [];

  jam(hub: string, bay: number): void {
    this.stuck.add(`${hub}/${String(bay)}`);
  }

  unjam(hub: string, bay: number): void {
    this.stuck.delete(`${hub}/${String(bay)}`);
  }

  /** Fires a latch. False when the latch is stuck. */
  fire(hub: string, bay: number): boolean {
    const key = `${hub}/${String(bay)}`;
    if (this.stuck.has(key)) return false;
    this.log.push(key);
    return true;
  }

  /** Every door opened so far, as hub/bay, oldest first. */
  opened(): string[] {
    return [...this.log];
  }
}
