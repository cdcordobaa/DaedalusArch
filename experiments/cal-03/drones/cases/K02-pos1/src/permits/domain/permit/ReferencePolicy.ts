import { CaaAirspaceAuthority } from '../../infrastructure/CaaAirspaceAuthority';

export class ReferencePolicy {
  private readonly authority = new CaaAirspaceAuthority();

  isExpected(reference: string, surveyId: string, start: Date): boolean {
    return reference === this.authority.requestClearance(surveyId, start, start);
  }
}
