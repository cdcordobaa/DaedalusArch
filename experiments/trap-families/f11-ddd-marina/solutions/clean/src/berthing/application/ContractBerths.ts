import type { PontoonRepository } from '../domain/pontoon/PontoonRepository';

/** Seasonal berths for members: answers contracts and frees the berths of members who leave. */
export class ContractBerths {
  constructor(private readonly pontoons: PontoonRepository) {}

  contractRequested(pontoonId: string, memberId: string, boatLengthM: number): void {
    const pontoon = this.pontoons.get(pontoonId);
    if (pontoon === undefined) return;
    pontoon.allocateFor(memberId, boatLengthM);
    this.pontoons.put(pontoon);
  }

  memberLeft(pontoonId: string, memberId: string): void {
    const pontoon = this.pontoons.get(pontoonId);
    if (pontoon === undefined) return;
    pontoon.releaseFor(memberId);
    this.pontoons.put(pontoon);
  }
}
