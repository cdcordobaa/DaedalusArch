export class PasswordPolicy {
  accepts(candidate: string): boolean {
    return candidate.length >= 12 && /[0-9]/.test(candidate);
  }
}
