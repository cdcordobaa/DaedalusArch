import { Injectable } from '@nestjs/common';
import { Attendee } from '../domain/attendee';
import { AttendeeRepository } from '../domain/attendee-repository';

@Injectable()
export class InMemoryAttendeeRepository implements AttendeeRepository {
  private readonly rows = new Map<string, Attendee>();

  async findById(id: string): Promise<Attendee | undefined> {
    return this.rows.get(id);
  }

  async save(attendee: Attendee): Promise<void> {
    this.rows.set(attendee.id, attendee);
  }
}
