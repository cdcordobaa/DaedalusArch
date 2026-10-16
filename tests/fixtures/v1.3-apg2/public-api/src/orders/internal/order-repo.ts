// NM-PA3: an import inside the component (order.service.ts) is not a deep import.
export class OrderRepo {
  total(id: string): number {
    return id.length;
  }
}
