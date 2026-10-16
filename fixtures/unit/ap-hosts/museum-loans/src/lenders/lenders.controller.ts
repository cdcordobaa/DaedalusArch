import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LendersService } from './lenders.service';
import { LenderView, RegisterLenderDto } from './dto/lender.dto';

@Controller('lenders')
export class LendersController {
  constructor(private readonly lenders: LendersService) {}

  @Post()
  register(@Body() dto: RegisterLenderDto): Promise<LenderView> {
    return this.lenders.register(dto.name, dto.country, dto.contactEmail, dto.anonymous);
  }

  @Get()
  byCountry(@Query('country') country: string): Promise<LenderView[]> {
    return this.lenders.byCountry(country);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LenderView> {
    return this.lenders.findOne(id);
  }
}
