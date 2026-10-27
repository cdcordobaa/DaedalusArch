import { AppointmentRepository } from '../domain/appointment/AppointmentRepository';

export class CancellationService {
  constructor(private repo: AppointmentRepository) {}
  cancel(id: string, now: number): void {
    const appt = this.repo.find(id);
    if (!appt) return;
    appt.cancel(now);
    this.repo.save(appt);
  }
}
