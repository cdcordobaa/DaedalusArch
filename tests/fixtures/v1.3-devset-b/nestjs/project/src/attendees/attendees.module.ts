import { Module } from '@nestjs/common';
import { ATTENDEE_REPOSITORY } from '../domain/attendee-repository';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { InMemoryAttendeeRepository } from './in-memory-attendee.repository';

@Module({
  controllers: [AttendeesController],
  providers: [AttendeesService, { provide: ATTENDEE_REPOSITORY, useClass: InMemoryAttendeeRepository }],
  exports: [ATTENDEE_REPOSITORY],
})
export class AttendeesModule {}
