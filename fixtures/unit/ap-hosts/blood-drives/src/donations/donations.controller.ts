import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationView, RecordDonationDto } from './dto/donation.dto';

@Controller()
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Post('appointments/:id/donation')
  record(@Param('id') id: string, @Body() dto: RecordDonationDto): Promise<DonationView> {
    return this.donations.record(id, dto.hemoglobin, dto.volumeMl, dto.bagNumber);
  }

  @Get('drives/:driveId/donations')
  forDrive(@Param('driveId') driveId: string): Promise<DonationView[]> {
    return this.donations.forDrive(driveId);
  }
}
