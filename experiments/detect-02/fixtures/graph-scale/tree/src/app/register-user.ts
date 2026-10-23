import { JobRepository } from '../repo/job.repository';
import { UserRepository } from '../repo/user.repository';
import { Notifier, PermissionsService, Evaluator } from '../ports/notifier';
import { EmailNotifier } from '../adapters/email-notifier';

export class RegisterUser {
  constructor(private readonly users: UserRepository, private readonly jobs: JobRepository, private readonly notifier: Notifier, private readonly perms: PermissionsService) {}

  async execute(name: string): Promise<void> {
    if (!this.perms.authorize(name)) return;
    await this.users.create({ name });
    await this.jobs.create({ status: 'queued' });
    await this.users.findOne({ name });
    await this.notifier.notify(name, 'welcome');
  }
}

export async function remind(email: EmailNotifier, users: UserRepository, ev: Evaluator): Promise<void> {
  ev.authorize('x');
  await users.rename('1', 'y');
  await email.notify('a', 'b');
}
