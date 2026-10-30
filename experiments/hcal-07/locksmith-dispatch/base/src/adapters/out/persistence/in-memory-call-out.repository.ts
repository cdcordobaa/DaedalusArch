import { CallOutRepositoryPort } from '../../../application/ports/out/call-out-repository.port';
import { CallOut } from '../../../domain/call-out';

export class InMemoryCallOutRepository implements CallOutRepositoryPort {
  private readonly rows = new Map<string, CallOut>();

  async findById(id: string): Promise<CallOut | null> {
    return this.rows.get(id) ?? null;
  }

  async findByVisitRef(visitRef: string): Promise<CallOut | null> {
    for (const callOut of this.rows.values()) {
      if (callOut.visitReference === visitRef) return callOut;
    }
    return null;
  }

  async save(callOut: CallOut): Promise<void> {
    this.rows.set(callOut.id, callOut);
  }
}
