import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from '../persistence/entities/course.entity';
import { EnrolmentEntity } from '../persistence/entities/enrolment.entity';
import { EnrolmentsController } from './enrolments.controller';
import { EnrolmentsService } from './enrolments.service';

@Module({
  imports: [TypeOrmModule.forFeature([EnrolmentEntity, CourseEntity])],
  controllers: [EnrolmentsController],
  providers: [EnrolmentsService],
})
export class EnrolmentsModule {}
