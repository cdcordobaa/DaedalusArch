import { InkwellSignatureError, type InkwellWebhookEvent, type InkwellWebhooks } from 'inkwell-sdk';
import type { RecordSigningOutcome } from '../../../application/ports/in/RecordSigningOutcome';
import type { SigningOutcome } from '../../../domain/model/SigningOutcome';

/** POST /inkwell/events: Inkwell's signed callbacks. Answers 401 to an unsigned one and 200 to every other. */
export class InkwellCallbackController {
  constructor(
    private readonly webhooks: InkwellWebhooks,
    private readonly outcomes: RecordSigningOutcome,
  ) {}

  async post(rawBody: string, signatureHeader: string): Promise<{ status: number }> {
    let event: InkwellWebhookEvent;
    try {
      event = this.webhooks.parse(rawBody, signatureHeader);
    } catch (e) {
      if (e instanceof InkwellSignatureError) return { status: 401 };
      throw e;
    }
    const outcome = InkwellCallbackController.outcomeOf(event);
    if (outcome !== undefined) await this.outcomes.record(event.envelopeId, outcome);
    return { status: 200 };
  }

  private static outcomeOf(event: InkwellWebhookEvent): SigningOutcome | undefined {
    switch (event.eventType) {
      case 'recipient.declined':
        return { kind: 'declined', by: event.recipient.emailAddress.toLowerCase(), reason: event.recipient.declineReason };
      case 'envelope.expired':
        return { kind: 'expired' };
      case 'envelope.completed':
        return { kind: 'signed' };
      default:
        return undefined;
    }
  }
}
