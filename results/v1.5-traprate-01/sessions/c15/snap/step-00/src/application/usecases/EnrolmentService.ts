import { CanteenError } from '../../domain/errors/CanteenError';
import { requireAllergens } from '../../domain/model/Allergens';
import { formatPence, requirePositivePence } from '../../domain/model/Pence';
import { Pupil } from '../../domain/model/Pupil';
import type { Enrolment, PupilView } from '../ports/in/Enrolment';
import type { PupilStore } from '../ports/out/PupilStore';

export const pupilView = (p: Pupil): PupilView => ({ id: p.id, name: p.name, className: p.className, allergies: [...p.allergies], balance: formatPence(p.balance) });

export class EnrolmentService implements Enrolment {
  constructor(private readonly pupils: PupilStore) {}

  enrol(name: string, className: string, allergies: readonly string[]): PupilView {
    const checked = requireAllergens(allergies);
    Pupil.checkDetails(name, className);
    const pupil = new Pupil(this.pupils.nextId(), name.trim(), className.trim(), checked);
    this.pupils.save(pupil);
    return pupilView(pupil);
  }

  topUp(pupilId: string, pence: unknown): PupilView {
    const amount = requirePositivePence(pence, 'a top-up');
    const pupil = this.find(pupilId);
    pupil.credit(amount);
    this.pupils.save(pupil);
    return pupilView(pupil);
  }

  pupil(pupilId: string): PupilView {
    return pupilView(this.find(pupilId));
  }

  private find(id: string): Pupil {
    const p = this.pupils.byId(id);
    if (p === null) throw new CanteenError(`no pupil ${id}`);
    return p;
  }
}
