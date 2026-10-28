import type { ReferenceFormat } from '../domain/permit/ReferenceFormat';

export class CaaReferenceFormat implements ReferenceFormat {
  expectedFor(surveyId: string, start: Date): string {
    return `CAA-${surveyId}-${start.getTime()}`;
  }
}
