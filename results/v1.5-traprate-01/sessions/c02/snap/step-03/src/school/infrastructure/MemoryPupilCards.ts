import type { PupilCards } from '../application/ports';

export class MemoryPupilCards implements PupilCards {
  private readonly names = new Map<string, string>();

  remember(passNo: string, holder: string): void {
    this.names.set(passNo, holder);
  }

  nameOf(passNo: string): string | undefined {
    return this.names.get(passNo);
  }
}
