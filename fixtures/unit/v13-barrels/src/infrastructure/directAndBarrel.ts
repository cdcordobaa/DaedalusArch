import { Order } from '../domain/entities/Order';
import { Order as Again } from '../application/ports/persistence';

export const pair = [new Order('3'), new Again('4')];
