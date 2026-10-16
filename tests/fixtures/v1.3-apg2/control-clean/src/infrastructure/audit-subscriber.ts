import { appEvents } from '../application';
// Allowed by the spec: infrastructure may react to application events (allowedAsync: infrastructure->application).
export function subscribeAudit(): void {
  appEvents.on('balance.read', (id: string) => console.log(id, Date.now()));
}
