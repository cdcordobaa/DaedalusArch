export interface CertificateBook {
  record(line: string): void;
  lines(): string[];
}
