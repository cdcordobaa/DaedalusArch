/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { SchedulingService } from '../../business/services/SchedulingService';
import { VisitNotesService } from '../../business/services/VisitNotesService';
import { AppointmentView, present } from '../presenters/AppointmentPresenter';

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
