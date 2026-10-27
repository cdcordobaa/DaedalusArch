/** Calendar days as YYYY-MM-DD strings. */
export const isEarlier = (day: string, than: string): boolean => day < than;

export const daysAfter = (day: string, days: number): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
