import { UserRepository } from '../infrastructure/user.repository';
import { UserDto } from './user.dto';

// The controller never imports user.record.ts or order.row.ts: every leak below is through an inferred or derived type.
export class UserController {
  constructor(private readonly repo: UserRepository) {}

  // TF1: inferred return type Promise<UserRecord> (a persistence model in an HTTP response).
  async get(id: number) {
    return this.repo.findById(id);
  }

  // TF2: inferred Promise<Array<OrderRow>> (generic + array + interface).
  async orders(userId: number) {
    return this.repo.findOrders(userId);
  }

  // TF3: parameter type derived from the repository's signature (indexed access), no import of the record.
  update(body: Parameters<UserRepository['save']>[0]): void {
    this.repo.save(body);
  }

  // TF4: an anonymous object type that carries the record.
  profile(id: number) {
    return { user: this.repo.findByIdSync(id), fetchedAt: 0 };
  }

  // NM-TF1: mapped to a DTO, no leak.
  async getDto(id: number): Promise<UserDto> {
    const r = await this.repo.findById(id);
    return new UserDto(r.id, r.name);
  }

  // NM-TF2: private helper, not public surface.
  private raw(id: number) {
    return this.repo.findByIdSync(id);
  }

  // NM-TF3 (protected): not public surface either.
  protected rawProtected(id: number) {
    return this.raw(id);
  }
}
