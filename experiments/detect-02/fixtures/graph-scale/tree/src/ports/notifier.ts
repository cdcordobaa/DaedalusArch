export interface Notifier {
  notify(to: string, text: string): Promise<void>;
}
export interface Evaluator {
  authorize(user: string): boolean;
}
export interface PermissionsService extends Evaluator {
  check(user: string, action: string): boolean;
}
