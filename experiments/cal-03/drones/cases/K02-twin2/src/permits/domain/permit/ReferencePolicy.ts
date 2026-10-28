import type { ReferenceFormat } from './ReferenceFormat';

export class ReferencePolicy {
  constructor(private readonly format: ReferenceFormat) {}

  isExpected(reference: string, surveyId: string, start: Date): boolean {
    return reference === this.format.expectedFor(surveyId, start);
  }
}
