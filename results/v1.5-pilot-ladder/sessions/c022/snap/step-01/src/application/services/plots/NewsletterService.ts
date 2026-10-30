import { GardenError } from '../../../domain/errors/GardenError';
import type { Newsletter } from '../../ports/out/mail/Newsletter';

export interface PublishNewsletter {
  publish(subject: string, text: string): Promise<boolean>;
}

export class NewsletterService implements PublishNewsletter {
  constructor(private readonly newsletter: Newsletter) {}

  async publish(subject: string, text: string): Promise<boolean> {
    if (subject.trim() === '' || text.trim() === '') throw new GardenError('a newsletter needs a subject and a text');
    await this.newsletter.publish(subject.trim(), text);
    return true;
  }
}
