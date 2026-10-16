import type { RehearsalRepository } from '../domain/rehearsal-repository';

export class RecordAttendance {
  constructor(private readonly rehearsals: RehearsalRepository) {}

  async execute(rehearsalId: string, singerIds: readonly string[]): Promise<number> {
    const rehearsal = await this.rehearsals.findById(rehearsalId);
    if (rehearsal === undefined) throw new Error(`unknown rehearsal ${rehearsalId}`);
    for (const id of singerIds) rehearsal.attended.add(id);
    await this.rehearsals.save(rehearsal);
    return rehearsal.attended.size;
  }
}
