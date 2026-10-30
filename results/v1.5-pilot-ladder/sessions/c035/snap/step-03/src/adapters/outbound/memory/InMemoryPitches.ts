import type { PitchInfo, Pitches } from '../../../application/ports/out/storage/Pitches';

export class InMemoryPitches implements Pitches {
  private readonly rows: PitchInfo[] = ['A1', 'A2', 'A3', 'A4', 'B5', 'B6'].map((pitch) => ({ pitch, state: 'open' as const }));

  constructor() {
    this.rows.push({ pitch: 'B7', state: 'closed_for_works' });
  }

  async find(pitch: string): Promise<PitchInfo | null> {
    return this.rows.find((p) => p.pitch === pitch) ?? null;
  }
}
