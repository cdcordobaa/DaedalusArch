/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { Body, Controller, Post } from '@nestjs/common';
import { Enrolment } from '../domain/enrolment';
import { EnrolDto } from './dto/enrol.dto';
import { EnrolmentsService } from './enrolments.service';
import { DomainError } from '../domain/domain-error';

@Controller('enrolments')
export class EnrolmentsController {
  constructor(private readonly enrolmentsService: EnrolmentsService) {}

  @Post()
  enrol(@Body() dto: EnrolDto): Promise<Enrolment> {
    if (!dto.studentEmail.includes('@')) {
      throw new DomainError('invalid', 'A valid student email is required');
    }
    return this.enrolmentsService.enrol(dto.courseId, dto.studentEmail);
  }

  @Post('withdrawals')
  async withdraw(@Body() dto: EnrolDto): Promise<{ refund: boolean }> {
    const refund = await this.enrolmentsService.withdraw(dto.courseId, dto.studentEmail);
    return { refund };
  }
}
