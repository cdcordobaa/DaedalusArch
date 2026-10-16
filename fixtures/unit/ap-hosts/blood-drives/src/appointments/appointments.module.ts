import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from '../persistence/schemas/appointment.schema';
import { Donor, DonorSchema } from '../persistence/schemas/donor.schema';
import { Drive, DriveSchema } from '../persistence/schemas/drive.schema';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Drive.name, schema: DriveSchema },
      { name: Donor.name, schema: DonorSchema },
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
