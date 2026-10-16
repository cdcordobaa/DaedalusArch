import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DriveStatsService, DriveStatsView } from './drive-stats.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly stats: DriveStatsService) {}

  @Post('drives/:driveId')
  load(@Param('driveId') driveId: string): Promise<DriveStatsView> {
    return this.stats.load(driveId);
  }

  @Get('regions/:region')
  month(@Param('region') region: string, @Query('year') year: string, @Query('month') month: string): Promise<DriveStatsView[]> {
    return this.stats.month(region, Number(year), Number(month));
  }
}
