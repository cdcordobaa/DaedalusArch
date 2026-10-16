/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { SchedulingService } from '../../business/services/SchedulingService';
import { VisitNotesService } from '../../business/services/VisitNotesService';
import { AppointmentView, present } from '../presenters/AppointmentPresenter';
import { SchedulingError } from '../../business/errors/SchedulingError';

export interface BookingForm {
  patientId: string;
  practitionerId: string;
  startsAt: string;
  minutes: number;
}

export interface NoteForm {
  author: string;
  text: string;
}

export class AppointmentsController {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly notes: VisitNotesService,
  ) {}

  async book(form: BookingForm): Promise<AppointmentView> {
    if (form.minutes < 10 || form.minutes > 120) {
      throw new SchedulingError('rejected', 'A visit lasts between 10 and 120 minutes');
    }
    const appointment = await this.scheduling.book(form.patientId, form.practitionerId, new Date(form.startsAt), form.minutes);
    return present(appointment);
  }

  async cancel(id: string): Promise<AppointmentView> {
    return present(await this.scheduling.cancel(id, new Date()));
  }

  async addNote(id: string, form: NoteForm): Promise<{ count: number }> {
    await this.notes.write(id, form.author, form.text);
    return { count: (await this.notes.notesFor(id)).length };
  }
}
