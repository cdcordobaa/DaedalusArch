import { Module } from '@nestjs/common';
import { AttendeesModule } from '../attendees/attendees.module';
import { REGISTRATION_REPOSITORY } from '../domain/registration-repository';
import { WorkshopsModule } from '../workshops/workshops.module';
import { InMemoryRegistrationRepository } from './in-memory-registration.repository';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [WorkshopsModule, AttendeesModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, { provide: REGISTRATION_REPOSITORY, useClass: InMemoryRegistrationRepository }],
})
export class RegistrationsModule {}
