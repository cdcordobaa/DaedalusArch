const DAY_MS = 86_400_000;

export class ReturnPolicy {
  accepts(purchasedAt: Date, today: Date): boolean {
    const days = Math.floor((today.getTime() - purchasedAt.getTime()) / DAY_MS);
    return days <= 30;
  }
}
