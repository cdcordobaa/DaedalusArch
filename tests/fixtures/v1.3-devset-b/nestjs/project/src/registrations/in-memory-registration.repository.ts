import { Injectable } from '@nestjs/common';
import { Registration } from '../domain/registration';
import { RegistrationRepository } from '../domain/registration-repository';

@Injectable()
export class InMemoryRegistrationRepository implements RegistrationRepository {
  private readonly rows = new Map<string, Registration>();

  async findById(id: string): Promise<Registration | undefined> {
    return this.rows.get(id);
  }

  async findByAttendee(attendeeId: string): Promise<Registration[]> {
    return [...this.rows.values()].filter((r) => r.attendeeId === attendeeId);
  }

  async save(registration: Registration): Promise<void> {
    this.rows.set(registration.id, registration);
  }
}
