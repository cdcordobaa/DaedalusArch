import { OrderRepository } from '../domain/repositories/OrderRepository';
import { RepositoryLinkFormatter } from './RepositoryLinkFormatter';

// look-alike (controller-bypasses-application): the dependency's name starts with "Repository" but is a formatter.
export class ReportController {
  constructor(private readonly links: RepositoryLinkFormatter) {}
  link(id: string): string {
    return this.links.format(id);
  }
}

// look-alike: a presenter (not a controller) may read the repository in this fixture's convention.
export class OrderPresenter {
  constructor(private readonly orders: OrderRepository) {}
  async exists(id: string): Promise<boolean> {
    return (await this.orders.findById(id)) !== undefined;
  }
}
