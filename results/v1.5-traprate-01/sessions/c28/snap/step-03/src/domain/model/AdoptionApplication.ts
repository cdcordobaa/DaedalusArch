import { ShelterError } from '../errors/ShelterError';
import { requireDay } from './Calendar';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** One adopter's request to adopt one pet. Only a pending application can be decided. */
export class AdoptionApplication {
  private constructor(
    readonly id: string,
    readonly petId: string,
    readonly adopterId: string,
    readonly submittedOn: string,
    private currentStatus: ApplicationStatus,
  ) {}

  static submit(id: string, petId: string, adopterId: string, on: string): AdoptionApplication {
    return new AdoptionApplication(id, petId, adopterId, requireDay(on), 'pending');
  }

  get status(): ApplicationStatus {
    return this.currentStatus;
  }

  isPending(): boolean {
    return this.currentStatus === 'pending';
  }

  approve(): void {
    this.requirePending();
    this.currentStatus = 'approved';
  }

  reject(): void {
    this.requirePending();
    this.currentStatus = 'rejected';
  }

  withdraw(): void {
    this.requirePending();
    this.currentStatus = 'withdrawn';
  }

  private requirePending(): void {
    if (!this.isPending()) throw new ShelterError(`application ${this.id} is not pending`);
  }
}
