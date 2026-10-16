import { NotificationsPort } from '../../../application/ports/notifications.port';

interface Mailer {
  send(to: string, template: string, data: Record<string, string>): Promise<void>;
}

export class MailNotificationsAdapter implements NotificationsPort {
  constructor(
    private readonly mailer: Mailer,
    private readonly clientPortalUrl: string,
  ) {}

  jobAssigned(translatorEmail: string, jobId: string, dueAt: Date): Promise<void> {
    return this.mailer.send(translatorEmail, 'job-assigned', { jobId, dueAt: dueAt.toISOString() });
  }

  deliveryReady(clientId: string, jobId: string): Promise<void> {
    return this.mailer.send(`client:${clientId}`, 'delivery-ready', { link: `${this.clientPortalUrl}/jobs/${jobId}` });
  }
}
