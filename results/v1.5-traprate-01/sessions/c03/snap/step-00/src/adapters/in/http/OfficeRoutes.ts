import type { Enrolment } from '../../../application/ports/in/Enrolment';
import type { Menu } from '../../../application/ports/in/Menu';
import { reply, type Reply } from '../shared/reply';

/** The school office: pupils, top-ups and the menu. */
export class OfficeRoutes {
  constructor(private readonly enrolment: Enrolment, private readonly menu: Menu) {}

  enrolPupil(name: string, className: string, allergies: string[] = []): Reply {
    return reply(() => this.enrolment.enrol(name, className, allergies));
  }

  topUp(pupilId: string, pence: unknown): Reply {
    return reply(() => this.enrolment.topUp(pupilId, pence));
  }

  pupil(pupilId: string): Reply {
    return reply(() => this.enrolment.pupil(pupilId));
  }

  addDish(name: string, pence: unknown, allergens: string[] = []): Reply {
    return reply(() => this.menu.addDish(name, pence, allergens));
  }
}
