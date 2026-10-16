export interface WaitlistEntry {
  readonly toolId: string;
  readonly memberId: string;
  readonly joinedAt: Date;
}

export function firstInLine(entries: readonly WaitlistEntry[]): WaitlistEntry | undefined {
  return [...entries].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
}
