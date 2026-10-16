export function euros(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}
