import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Donor, DonorSchema } from '../persistence/schemas/donor.schema';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Donor.name, schema: DonorSchema }])],
  controllers: [DonorsController],
  providers: [DonorsService],
})
export class DonorsModule {}
