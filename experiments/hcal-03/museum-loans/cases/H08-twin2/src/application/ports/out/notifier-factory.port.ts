import { Notifier } from './notifier.port';

export interface NotifierFactory {
  for(kind: 'borrower' | 'registrar'): Notifier;
}
