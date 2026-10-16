import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentView, BookAppointmentDto, CancelAppointmentDto } from './dto/appointment.dto';

@Controller()
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post('drives/:driveId/appointments')
  book(@Param('driveId') driveId: string, @Body() dto: BookAppointmentDto): Promise<AppointmentView> {
    return this.appointments.book(driveId, dto.donorId, dto.startsAt);
  }

  @Get('drives/:driveId/appointments')
  forDrive(@Param('driveId') driveId: string): Promise<AppointmentView[]> {
    return this.appointments.forDrive(driveId);
  }

  @Patch('appointments/:id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelAppointmentDto): Promise<AppointmentView> {
    return this.appointments.cancel(id, dto.reason);
  }
}
