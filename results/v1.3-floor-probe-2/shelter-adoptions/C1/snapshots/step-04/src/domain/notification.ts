export type NotifyBy = 'email' | 'sms';
export type Delivery = 'pending' | 'delivered' | 'failed-resent-by-email' | 'sent-by-email';

export interface Addressee { name: string; email: string; phone?: string; notifyBy?: NotifyBy }

export class Notification {
  public delivery: Delivery;
  public providerId?: string;
  public history: { at: string; delivery: Delivery }[] = [];

  constructor(readonly id: string, readonly to: Addressee, readonly channel: NotifyBy, readonly subject: string, readonly text: string, at: string) {
    this.delivery = channel === 'email' ? 'sent-by-email' : 'pending';
    this.history.push({ at, delivery: this.delivery });
  }

  setDelivery(d: Delivery, at: string): void {
    this.delivery = d;
    this.history.push({ at, delivery: d });
  }

  static smsBody(subject: string, text: string): string {
    const full = `${subject} - ${text}`;
    return full.length > 160 ? full.slice(0, 157) + '...' : full;
  }
}
