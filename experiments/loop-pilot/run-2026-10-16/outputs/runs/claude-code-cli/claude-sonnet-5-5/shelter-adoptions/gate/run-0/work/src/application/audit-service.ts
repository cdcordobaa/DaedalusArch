import type { AuditEntry } from "../domain/audit.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { AnimalRepository, AuditLogReader } from "./ports.js";

export class AuditService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly log: AuditLogReader,
  ) {}

  /** Changes to the animal and to its applications and placements, oldest first. */
  async listForAnimal(animalId: string): Promise<AuditEntry[]> {
    if (!(await this.animals.findById(animalId))) throw new NotFoundError(`Animal ${animalId} not found`);
    return this.log.findByAnimalId(animalId);
  }

  /** Changes made by one actor between `from` and `to`, both inclusive. */
  async listForActor(actor: string, from: string | undefined, to: string | undefined): Promise<AuditEntry[]> {
    if (!actor.trim()) throw new ValidationError("staff id is required");
    if (!from || Number.isNaN(Date.parse(from))) throw new ValidationError("from must be a valid date");
    if (!to || Number.isNaN(Date.parse(to))) throw new ValidationError("to must be a valid date");
    if (Date.parse(from) > Date.parse(to)) throw new ValidationError("from must not be after to");
    return this.log.findByActor(actor, from, to);
  }
}
