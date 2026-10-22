export class TicketRepository {
  private readonly rows = new Map<string, { title: string; closed: boolean }>();

  insert(title: string): string {
    const id = `t-${String(this.rows.size + 1)}`;
    this.rows.set(id, { title, closed: false });
    return id;
  }

  close(ticketId: string): void {
    const row = this.rows.get(ticketId);
    if (row !== undefined) row.closed = true;
  }
}
