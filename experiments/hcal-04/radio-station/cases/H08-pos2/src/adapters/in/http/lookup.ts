import { container } from '../../../application/container';
import type { Notifier } from '../../../application/ports/out/notifier';

export function resolveNotifier(): Notifier {
  return container.get<Notifier>('notifier');
}
