export enum ReportGranularity {
  Second = 'second',
  Minute = 'minute',
}

export function describe(granularity: ReportGranularity): string {
  return granularity === ReportGranularity.Second ? 'to the second' : 'to the nearest minute';
}
