export interface ClientNotifier {
  notifyBooked(clientEmail: string, surveyId: string): void;
}
