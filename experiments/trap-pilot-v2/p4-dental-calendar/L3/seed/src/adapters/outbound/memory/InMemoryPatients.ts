import type { Patients } from '../../../application/ports/out/storage/Patients';

export class InMemoryPatients implements Patients {
  private readonly withOpenBills = new Set(['P-9']);

  async hasOpenBill(patientId: string): Promise<boolean> {
    return this.withOpenBills.has(patientId);
  }
}
