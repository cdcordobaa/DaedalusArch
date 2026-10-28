import { HostUnavailableError } from '../domain/errors';
import { SchedulePolicy } from '../domain/schedule-policy';
import { Show, TimeSlot } from '../domain/show';
import type { ScheduleShowCommand, ScheduleShowPort } from './ports/in/schedule-show.port';
import type { HostRepository } from './ports/out/host.repository';
import type { Notifier } from './ports/out/notifier';
import type { ShowRepository } from './ports/out/show.repository';

export class ScheduleShowUseCase implements ScheduleShowPort {
  private readonly policy = new SchedulePolicy();

  constructor(
    private readonly shows: ShowRepository,
    private readonly hosts: HostRepository,
    private readonly notifier: Notifier,
  ) {}

  async execute(command: ScheduleShowCommand): Promise<Show> {
    const host = await this.hosts.findById(command.hostId);
    if (!host) throw new HostUnavailableError(`Unknown host ${command.hostId}`);
    const existing = await this.shows.findByDay(command.dayOfWeek);
    const id = `${command.title.toLowerCase().replace(/\s+/g, '-')}-${command.dayOfWeek}-${command.startMinute}`;
    const show = new Show(id, command.title, host.id, new TimeSlot(command.dayOfWeek, command.startMinute, command.lengthMinutes));
    this.policy.assertCanSchedule(host, existing, show);
    await this.shows.save(show);
    await this.notifier.send(host.email, 'Show scheduled', `${show.title} is on the air schedule`);
    return show;
  }
}
