export abstract class AuditSink {
  abstract write(line: string): void;
}
export class ConsoleAuditSink extends AuditSink {
  write(_line: string): void {
    // no-op in the fixture
  }
}
