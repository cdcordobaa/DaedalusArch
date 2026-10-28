import { DomainError } from '../../../domain/errors';
import type { ScheduleShowPort } from '../../../application/ports/in/schedule-show.port';
import type { HttpResult } from './http-result';
import type { ScheduleShowRequestDto, ScheduleShowResponseDto } from './show.dto';

export class ShowController {
  constructor(private readonly scheduleShow: ScheduleShowPort) {}

  async post(dto: ScheduleShowRequestDto): Promise<HttpResult<ScheduleShowResponseDto>> {
    try {
      const show = await this.scheduleShow.execute({
        title: dto.title,
        hostId: dto.hostId,
        dayOfWeek: dto.day,
        startMinute: dto.start,
        lengthMinutes: dto.length,
      });
      return { status: 201, body: { id: show.id } };
    } catch (error) {
      if (error instanceof DomainError) return { status: 409, body: { error: error.message } };
      throw error;
    }
  }
}
