import type { PhoneNumber } from '../../domain/model/PhoneNumber';
import type { SentText } from '../../domain/model/SentText';
import type { OptOuts } from '../ports/out/OptOuts';
import { TextOptedOutError } from '../ports/out/TextMessages';
import type { TextMessages } from '../ports/out/TextMessages';

/** Never attempts a text to a number that opted out, and remembers numbers the provider reports as opted out. */
export class OptOutAwareTexts implements TextMessages {
  constructor(
    private readonly inner: TextMessages,
    private readonly optOuts: OptOuts,
  ) {}

  async send(to: PhoneNumber, text: string): Promise<SentText> {
    if (await this.optOuts.has(to)) throw new TextOptedOutError('recipient opted out');
    try {
      return await this.inner.send(to, text);
    } catch (e) {
      if (e instanceof TextOptedOutError) await this.optOuts.add(to);
      throw e;
    }
  }

  deliveryOf(textId: string): Promise<'delivered' | 'failed' | 'sent'> {
    return this.inner.deliveryOf(textId);
  }
}
