import { RequestRefused } from './RequestRefused';

export const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;

/** An ABO group with its RhD sign, written the way the wards write it: 'A+', 'O-', 'AB+'. */
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export function bloodGroup(text: string): BloodGroup {
  const found = BLOOD_GROUPS.find((g) => g === text.trim().toUpperCase());
  if (found === undefined) throw new RequestRefused(`unknown blood group: ${text}`);
  return found;
}

/** The ABO letters of a group, without the RhD sign. */
export function letters(group: BloodGroup): string {
  return group.slice(0, -1);
}

export function isRhesusNegative(group: BloodGroup): boolean {
  return group.endsWith('-');
}
