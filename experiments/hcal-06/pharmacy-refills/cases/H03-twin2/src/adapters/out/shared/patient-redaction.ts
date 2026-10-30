export function maskPatientId(id: string): string {
  return id.length <= 4 ? '****' : `****${id.slice(-4)}`;
}
