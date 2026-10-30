import { RefillRepositoryPort } from '../../../application/ports/out/refill-repository.port';
import { Refill } from '../../../domain/refill';
import { maskPatientId } from '../notification/console-patient-notifier';

export class InMemoryRefillRepository implements RefillRepositoryPort {
  private readonly rows = new Map<string, Refill>();

  async findById(id: string): Promise<Refill | null> {
    return this.rows.get(id) ?? null;
  }

  async save(refill: Refill): Promise<void> {
    this.rows.set(refill.id, refill);
    console.log(`[store] saved refill ${refill.id} for ${maskPatientId(refill.patientId)}`);
  }
}
