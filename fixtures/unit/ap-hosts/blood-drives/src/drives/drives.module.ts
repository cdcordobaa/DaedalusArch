import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Drive, DriveSchema } from '../persistence/schemas/drive.schema';
import { DrivesController } from './drives.controller';
import { DrivesService } from './drives.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Drive.name, schema: DriveSchema }])],
  controllers: [DrivesController],
  providers: [DrivesService],
})
export class DrivesModule {}
