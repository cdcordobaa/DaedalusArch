import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { WorkshopResponseDto } from './dto/workshop-response.dto';
import { WorkshopsService } from './workshops.service';

@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshopsService: WorkshopsService) {}

  @Post()
  create(@Body() dto: CreateWorkshopDto): Promise<WorkshopResponseDto> {
    return this.workshopsService.create(dto);
  }

  @Get()
  findAll(): Promise<WorkshopResponseDto[]> {
    return this.workshopsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<WorkshopResponseDto> {
    return this.workshopsService.findOne(id);
  }
}
