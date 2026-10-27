export interface Notifier {
  notifyReceived(to: string, openingTitle: string): Promise<void>;
  notifyInterview(to: string, startsAt: Date): Promise<void>;
}
