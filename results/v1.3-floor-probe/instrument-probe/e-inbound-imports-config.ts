import { mailer } from '../../config/main';
export function outbox(): number { return mailer.outbox.length; }
