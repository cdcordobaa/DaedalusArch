import { FakeMailer } from '../adapters/outbound/fake-mailer';
export class WarningService {
  constructor(private readonly mailer: FakeMailer) {}
  warn(to: string): void { this.mailer.send(to, 'x', 'y'); }
}
