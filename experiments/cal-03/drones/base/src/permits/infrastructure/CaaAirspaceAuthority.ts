import type { AirspaceAuthority } from '../application/ports/AirspaceAuthority';

export class CaaAirspaceAuthority implements AirspaceAuthority {
  requestClearance(surveyRef: string, from: Date, _to: Date): string {
    return `CAA-${surveyRef}-${from.getTime()}`;
  }
}
