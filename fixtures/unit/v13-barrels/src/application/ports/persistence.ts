// Persistence port barrel: re-exports domain types only (the order-fulfilment shape).
export type { OrderRepository } from '../../domain/repositories/OrderRepository';
export { Order, type OrderSnapshot } from '../../domain/entities/Order';
export type { OrderStatus } from '../../domain/value-objects/OrderStatus';
export { Money as Amount } from '../../domain/value-objects/Money';
