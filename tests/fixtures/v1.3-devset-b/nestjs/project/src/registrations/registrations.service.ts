import { Inject, Injectable } from '@nestjs/common';
import { ATTENDEE_REPOSITORY, AttendeeRepository } from '../domain/attendee-repository';
import { DomainError } from '../domain/domain-error';
import { Registration } from '../domain/registration';
import { RegistrationPolicy } from '../domain/registration-policy';
import { REGISTRATION_REPOSITORY, RegistrationRepository } from '../domain/registration-repository';
import { WORKSHOP_REPOSITORY, WorkshopRepository } from '../domain/workshop-repository';
import { RegisterAttendeeDto } from './dto/register-attendee.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';

@Injectable()
export class RegistrationsService {
  private readonly policy = new RegistrationPolicy();
  private sequence = 0;

  constructor(
    @Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository,
    @Inject(ATTENDEE_REPOSITORY) private readonly attendees: AttendeeRepository,
    @Inject(REGISTRATION_REPOSITORY) private readonly registrations: RegistrationRepository,
  ) {}

  async register(dto: RegisterAttendeeDto): Promise<RegistrationResponseDto> {
    const workshop = await this.workshops.findById(dto.workshopId);
    if (workshop === undefined) throw new DomainError('not-found', `No workshop ${dto.workshopId}`);
    const attendee = await this.attendees.findById(dto.attendeeId);
    if (attendee === undefined) throw new DomainError('not-found', `No attendee ${dto.attendeeId}`);

    const now = new Date();
    this.policy.assertCanRegister(workshop, attendee, await this.registrations.findByAttendee(attendee.id), now);
    workshop.takeSeat();
    this.sequence += 1;
    const registration = new Registration(`rg-${this.sequence}`, workshop.id, attendee.id, now);
    await this.workshops.save(workshop);
    await this.registrations.save(registration);
    return RegistrationResponseDto.from(registration);
  }

  async cancel(id: string): Promise<RegistrationResponseDto> {
    const registration = await this.registrations.findById(id);
    if (registration === undefined) throw new DomainError('not-found', `No registration ${id}`);
    registration.cancel(new Date());
    const workshop = await this.workshops.findById(registration.workshopId);
    if (workshop !== undefined) {
      workshop.releaseSeat();
      await this.workshops.save(workshop);
    }
    await this.registrations.save(registration);
    return RegistrationResponseDto.from(registration);
  }
}
