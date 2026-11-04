const READING_FIELDS: Record<string, 'hiveTag' | 'broodTempC' | 'takenAt'> = {
  hive_tag: 'hiveTag',
  brood_temp_c: 'broodTempC',
  timestamp: 'takenAt',
};

export function readingValues(frame: Readonly<Record<string, unknown>>): Partial<Record<'hiveTag' | 'broodTempC' | 'takenAt', unknown>> {
  const out: Partial<Record<'hiveTag' | 'broodTempC' | 'takenAt', unknown>> = {};
  for (const [vendorField, coreField] of Object.entries(READING_FIELDS)) out[coreField] = frame[vendorField];
  return out;
}
