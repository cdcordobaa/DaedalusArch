import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AttendeesService } from './attendees.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';

@Controller('attendees')
export class AttendeesController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Post()
  create(@Body() dto: CreateAttendeeDto): Promise<{ id: string; name: string }> {
    return this.attendeesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<{ id: string; name: string }> {
    return this.attendeesService.findOne(id);
  }
}
