import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DrivesService } from './drives.service';
import { CloseDriveDto, DriveView, ScheduleDriveDto } from './dto/drive.dto';

@Controller('drives')
export class DrivesController {
  constructor(private readonly drives: DrivesService) {}

  @Post()
  schedule(@Body() dto: ScheduleDriveDto): Promise<DriveView> {
    return this.drives.schedule(dto.siteName, dto.region, dto.opensAt, dto.closesAt, dto.beds, dto.slotMinutes);
  }

  @Get()
  inRegion(@Query('region') region: string, @Query('from') from: string): Promise<DriveView[]> {
    return this.drives.inRegion(region, from);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseDriveDto): Promise<DriveView> {
    return this.drives.close(id, dto.collectedUnits);
  }
}
