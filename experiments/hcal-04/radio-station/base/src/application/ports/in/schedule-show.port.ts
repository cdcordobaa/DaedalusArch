import type { Show } from '../../../domain/show';

export interface ScheduleShowCommand {
  title: string;
  hostId: string;
  dayOfWeek: number;
  startMinute: number;
  lengthMinutes: number;
}

export interface ScheduleShowPort {
  execute(command: ScheduleShowCommand): Promise<Show>;
}
