import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from '../persistence/schemas/appointment.schema';
import { Donation, DonationSchema } from '../persistence/schemas/donation.schema';
import { Donor, DonorSchema } from '../persistence/schemas/donor.schema';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Donation.name, schema: DonationSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Donor.name, schema: DonorSchema },
    ]),
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}
