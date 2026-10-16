import { Inject, Injectable } from '@nestjs/common';
import { Attendee } from '../domain/attendee';
import { ATTENDEE_REPOSITORY, AttendeeRepository } from '../domain/attendee-repository';
import { DomainError } from '../domain/domain-error';
import { CreateAttendeeDto } from './dto/create-attendee.dto';

@Injectable()
export class AttendeesService {
  private sequence = 0;

  constructor(@Inject(ATTENDEE_REPOSITORY) private readonly attendees: AttendeeRepository) {}

  async create(dto: CreateAttendeeDto): Promise<{ id: string; name: string }> {
    this.sequence += 1;
    const attendee = new Attendee(`at-${this.sequence}`, dto.name, dto.email);
    await this.attendees.save(attendee);
    return { id: attendee.id, name: attendee.name };
  }

  async findOne(id: string): Promise<{ id: string; name: string }> {
    const attendee = await this.attendees.findById(id);
    if (attendee === undefined) throw new DomainError('not-found', `No attendee ${id}`);
    return { id: attendee.id, name: attendee.name };
  }
}
