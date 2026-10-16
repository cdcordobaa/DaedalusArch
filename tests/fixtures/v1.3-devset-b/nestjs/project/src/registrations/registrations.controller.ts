import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { RegisterAttendeeDto } from './dto/register-attendee.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { RegistrationsService } from './registrations.service';

@Controller('registrations')
@UseGuards(ApiKeyGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  register(@Body() dto: RegisterAttendeeDto): Promise<RegistrationResponseDto> {
    return this.registrationsService.register(dto);
  }

  @Delete(':id')
  cancel(@Param('id') id: string): Promise<RegistrationResponseDto> {
    return this.registrationsService.cancel(id);
  }
}
