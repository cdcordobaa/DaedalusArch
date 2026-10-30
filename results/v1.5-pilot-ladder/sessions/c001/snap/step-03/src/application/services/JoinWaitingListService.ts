import type { Applicant } from '../../domain/model/Applicant';
import { GardenError } from '../../domain/errors/GardenError';
import type { ApplicantView, JoinWaitingList, LeaveView } from '../ports/in/WaitingList';
import type { Applicants } from '../ports/out/Applicants';
import type { Letters } from '../ports/out/Letters';

export class JoinWaitingListService implements JoinWaitingList {
  constructor(
    private readonly applicants: Applicants,
    private readonly letters: Letters,
  ) {}

  async join(name: string, email: string): Promise<ApplicantView> {
    if (name.trim() === '') throw new GardenError('a name is required');
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new GardenError('that is not an email address');
    const all = await this.applicants.all();
    if (all.some((a) => a.email === email)) throw new GardenError('this address is already on the list');
    const applicant: Applicant = { name: name.trim(), email };
    await this.applicants.add(applicant);
    await this.letters.send(applicant, 'welcome', { name: applicant.name });
    return { name: applicant.name, position: all.length + 1 };
  }

  async leave(email: string): Promise<LeaveView> {
    const all = await this.applicants.all();
    if (!all.some((a) => a.email === email)) return { left: false };
    await this.applicants.remove(email);
    return { left: true };
  }

  async list():Promise<ApplicantView[]> {
    return (await this.applicants.all()).map((a, i) => ({ name: a.name, position: i + 1 }));
  }
}
