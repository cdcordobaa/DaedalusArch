import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DonorsService } from './donors.service';
import { DeferDonorDto, DonorView, RegisterDonorDto } from './dto/donor.dto';

@Controller('donors')
export class DonorsController {
  constructor(private readonly donors: DonorsService) {}

  @Post()
  register(@Body() dto: RegisterDonorDto): Promise<DonorView> {
    return this.donors.register(dto.fullName, dto.birthDate, dto.sex, dto.bloodType, dto.phone);
  }

  @Get('recall')
  recall(@Query('bloodType') bloodType: string, @Query('limit') limit: string): Promise<DonorView[]> {
    return this.donors.recallCandidates(bloodType, Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<DonorView> {
    return this.donors.findOne(id);
  }

  @Patch(':id/deferral')
  defer(@Param('id') id: string, @Body() dto: DeferDonorDto): Promise<DonorView> {
    return this.donors.defer(id, dto.reason, dto.weeks);
  }
}
