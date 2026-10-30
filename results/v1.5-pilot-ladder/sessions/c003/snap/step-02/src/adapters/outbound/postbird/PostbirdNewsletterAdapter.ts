import type { PostbirdClient } from 'postbird-sdk';
import type { Newsletter } from '../../../application/ports/out/mail/Newsletter';

export class PostbirdNewsletterAdapter implements Newsletter {
  constructor(private readonly client: PostbirdClient) {}

  async publish(subject: string, text: string): Promise<void> {
    await this.client.sendTemplate({ to: 'members@list.example', templateId: 'newsletter', variables: { subject, text } });
  }
}
