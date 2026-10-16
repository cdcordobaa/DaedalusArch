import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, AppointmentSchema } from '../persistence/schemas/appointment.schema';
import { Drive, DriveSchema } from '../persistence/schemas/drive.schema';
import { DriveStatsRow } from '../persistence/warehouse/drive-stats.entity';
import { DriveStatsService } from './drive-stats.service';
import { ReportingController } from './reporting.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriveStatsRow]),
    MongooseModule.forFeature([
      { name: Drive.name, schema: DriveSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
  ],
  controllers: [ReportingController],
  providers: [DriveStatsService],
})
export class ReportingModule {}
