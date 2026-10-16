// Composition root: outside every bounded context, wires both contexts.
import { PlaceOrder } from './ordering/application/PlaceOrder.js';
import { GetOrderSummary } from './ordering/application/GetOrderSummary.js';
import { InMemoryOrderRepository } from './ordering/infrastructure/InMemoryOrderRepository.js';
import { InMemoryCustomerRepository } from './ordering/infrastructure/InMemoryCustomerRepository.js';
import { OrderController } from './ordering/api/OrderController.js';
import { IssueInvoice } from './billing/application/IssueInvoice.js';
import { GetInvoiceView } from './billing/application/GetInvoiceView.js';
import { OrderingAcl } from './billing/acl/OrderingAcl.js';
import { InMemoryInvoiceRepository } from './billing/infrastructure/InMemoryInvoiceRepository.js';
import { InvoiceController } from './billing/api/InvoiceController.js';

export function compose(): { orders: OrderController; invoices: InvoiceController } {
  const orderRepo = new InMemoryOrderRepository();
  const customers = new InMemoryCustomerRepository(new Map());
  const orders = new OrderController(new PlaceOrder(orderRepo, customers));
  const acl = new OrderingAcl(new GetOrderSummary(orderRepo));
  const invoiceRepo = new InMemoryInvoiceRepository();
  const invoices = new InvoiceController(new IssueInvoice(acl, invoiceRepo, 0.2), new GetInvoiceView(invoiceRepo));
  return { orders, invoices };
}
