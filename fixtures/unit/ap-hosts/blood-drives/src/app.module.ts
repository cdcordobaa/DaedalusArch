import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from './appointments/appointments.module';
import { CLOCK } from './domain/clock';
import { DonationsModule } from './donations/donations.module';
import { DonorsModule } from './donors/donors.module';
import { DrivesModule } from './drives/drives.module';
import { SystemClock } from './infrastructure/system-clock';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env['MONGO_URI']),
    TypeOrmModule.forRoot({ type: 'postgres', url: process.env['WAREHOUSE_URL'], synchronize: false }),
    DonorsModule,
    DrivesModule,
    AppointmentsModule,
    DonationsModule,
    ReportingModule,
  ],
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class AppModule {}
