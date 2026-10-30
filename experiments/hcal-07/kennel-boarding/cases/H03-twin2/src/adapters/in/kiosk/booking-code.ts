export function parseBookingCode(scanned: string): string {
  const code = scanned.trim().toUpperCase();
  return code.startsWith('BK-') ? code.slice(3) : code;
}
