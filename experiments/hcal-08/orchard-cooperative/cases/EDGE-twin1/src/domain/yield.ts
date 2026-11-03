export function litresPerCrate(litres: number, crates: number): number {
  return crates > 0 ? litres / crates : 0;
}
