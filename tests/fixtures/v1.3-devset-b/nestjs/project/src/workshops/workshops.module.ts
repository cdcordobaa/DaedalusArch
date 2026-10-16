import { Module } from '@nestjs/common';
import { WORKSHOP_REPOSITORY } from '../domain/workshop-repository';
import { InMemoryWorkshopRepository } from './in-memory-workshop.repository';
import { WorkshopsController } from './workshops.controller';
import { WorkshopsService } from './workshops.service';

@Module({
  controllers: [WorkshopsController],
  providers: [WorkshopsService, { provide: WORKSHOP_REPOSITORY, useClass: InMemoryWorkshopRepository }],
  exports: [WORKSHOP_REPOSITORY],
})
export class WorkshopsModule {}
