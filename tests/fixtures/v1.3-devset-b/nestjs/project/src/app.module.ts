import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AttendeesModule } from './attendees/attendees.module';
import { DomainErrorFilter } from './common/filters/domain-error.filter';
import { RegistrationsModule } from './registrations/registrations.module';
import { WorkshopsModule } from './workshops/workshops.module';

@Module({
  imports: [WorkshopsModule, AttendeesModule, RegistrationsModule],
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
