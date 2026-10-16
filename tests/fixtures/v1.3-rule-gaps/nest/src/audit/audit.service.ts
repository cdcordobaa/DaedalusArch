import { Injectable } from '@nestjs/common';
import { AuditSink } from './audit-sink';

// look-alike (nest-provider-not-visible): AuditSink is a token bound with useClass; no module provides the class
// AuditSink itself, so the rule does not decide it.
@Injectable()
export class AuditService {
  constructor(private readonly sink: AuditSink) {}
  log(s: string): void {
    this.sink.write(s);
  }
}
