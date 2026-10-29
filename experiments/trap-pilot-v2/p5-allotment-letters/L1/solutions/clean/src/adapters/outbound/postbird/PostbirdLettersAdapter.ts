import type { PostbirdClient } from 'postbird-sdk';
import type { Applicant } from '../../../domain/model/Applicant';
import type { LetterKind, Letters } from '../../../application/ports/out/Letters';

const TEMPLATES: Record<LetterKind, string> = { welcome: 'waitlist-welcome', offer: 'plot-offer' };

export class PostbirdLettersAdapter implements Letters {
  constructor(private readonly client: PostbirdClient) {}

  async send(to: Applicant, letter: LetterKind, details: Record<string, string>): Promise<boolean> {
    const receipt = await this.client.sendTemplate({ to: to.email, templateId: TEMPLATES[letter], variables: details });
    return receipt.state !== 'rejected';
  }
}
