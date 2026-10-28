export interface Notifier {
  notify(memberId: string, subject: string, body: string): Promise<void>;
}
