import { IdGeneratorPort } from '../../application/ports/id-generator.port';

/** RFC 4122 version-4 ids from the platform's crypto source. */
export class UuidGenerator implements IdGeneratorPort {
  constructor(private readonly randomUUID: () => string) {}

  next(): string {
    return this.randomUUID();
  }
}
