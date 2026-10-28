import type { Noticeboard } from '../application/ports/Noticeboard';

export class MemoryNoticeboard implements Noticeboard {
  private readonly pinned: string[] = [];

  pin(note: string): void {
    this.pinned.push(note);
  }

  notes(): string[] {
    return this.pinned.slice();
  }
}
