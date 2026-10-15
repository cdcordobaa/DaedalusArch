// Public API of the ordering context: the only files other contexts may import.
export type { OrderSummary, OrderSummaryQuery } from './contracts/OrderSummary.js';
// The query service is published through the barrel as well.
export { GetOrderSummary } from './application/GetOrderSummary.js';
