// A project class with an `emit` method: not an event emitter (NM-AS2).
export class Logger {
  emit(line: string): void {
    void line;
  }
}
