import type { CertificateBook } from '../application/ports/CertificateBook';

export class MemoryCertificateBook implements CertificateBook {
  private readonly written: string[] = [];

  record(line: string): void {
    this.written.push(line);
  }

  lines(): string[] {
    return this.written.slice();
  }
}
