import { Module } from '@nestjs/common';
import { FormatterService } from '../shared/formatter.service';
import { ReportsService } from './reports.service';

@Module({
  providers: [ReportsService, FormatterService],
})
export class ReportsModule {}
