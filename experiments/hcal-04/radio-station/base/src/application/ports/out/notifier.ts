export interface Notifier {
  send(to: string, subject: string, body: string): Promise<void>;
}
