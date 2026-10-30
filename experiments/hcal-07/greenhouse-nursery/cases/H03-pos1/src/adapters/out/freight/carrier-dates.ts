export function parseCarrierDate(value: string): Date {
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`bad date ${value}`);
  return parsed;
}
