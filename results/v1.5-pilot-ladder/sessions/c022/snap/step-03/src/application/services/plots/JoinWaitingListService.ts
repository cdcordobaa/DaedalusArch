import type { Applicant } from '../../../domain/model/Applicant';
import { GardenError } from '../../../domain/errors/GardenError';
import type { ApplicantView, JoinWaitingList } from '../../ports/in/WaitingList';
import type { Applicants } from '../../ports/out/storage/Applicants';

export class JoinWaitingListService implements JoinWaitingList {
  constructor(
    private readonly applicants: Applicants,
  ) {}

  async join(name: string, email: string, member: boolean): Promise<ApplicantView> {
    if (name.trim() === '') throw new GardenError('a name is required');
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new GardenError('that is not an email address');
    const all = await this.applicants.all();
    if (all.some((a) => a.email === email)) throw new GardenError('this address is already on the list');
    const applicant: Applicant = { name: name.trim(), email, member };
    await this.applicants.add(applicant);
    return { name: applicant.name, position: all.length + 1 };
  }

  async list(): Promise<ApplicantView[]> {
    return (await this.applicants.all()).map((a, i) => ({ name: a.name, position: i + 1 }));
  }
}
