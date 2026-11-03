export type IntakeCheck = 'PRIME' | 'BRUISED' | 'WORMY' | 'FROSTED';

export function acceptsForPressing(check: IntakeCheck): boolean {
  return check !== 'WORMY';
}
