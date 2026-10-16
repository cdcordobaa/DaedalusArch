import { Module } from '@nestjs/common';
import { CoursesModule } from './courses/courses.module';
import { EnrolmentsModule } from './enrolments/enrolments.module';

@Module({ imports: [CoursesModule, EnrolmentsModule] })
export class AppModule {}
