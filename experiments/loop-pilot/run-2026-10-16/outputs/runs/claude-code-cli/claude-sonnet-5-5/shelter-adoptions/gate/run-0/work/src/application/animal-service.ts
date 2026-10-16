import { markReady, type Animal } from "../domain/animal.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { AnimalRepository, ChangeStore, IdGenerator } from "./ports.js";

export interface RegisterAnimalCommand {
  species: string;
  name: string;
  estimatedAgeMonths: number;
  intakeDate: string;
  medicalNotes: string;
}

export class AnimalService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly changes: ChangeStore,
    private readonly ids: IdGenerator,
  ) {}

  async register(cmd: RegisterAnimalCommand, actor: string): Promise<Animal> {
    if (!cmd.species.trim()) throw new ValidationError("species is required");
    if (!cmd.name.trim()) throw new ValidationError("name is required");
    if (!Number.isFinite(cmd.estimatedAgeMonths) || cmd.estimatedAgeMonths < 0) {
      throw new ValidationError("estimatedAgeMonths must be a non-negative number");
    }
    if (Number.isNaN(Date.parse(cmd.intakeDate))) {
      throw new ValidationError("intakeDate must be a valid date");
    }
    const animal: Animal = {
      id: this.ids.next(),
      species: cmd.species.trim(),
      name: cmd.name.trim(),
      estimatedAgeMonths: cmd.estimatedAgeMonths,
      intakeDate: cmd.intakeDate,
      medicalNotes: cmd.medicalNotes,
      status: "in_care",
    };
    await this.changes.commit([{ entityType: "animal", entity: animal }], actor);
    return animal;
  }

  async get(id: string): Promise<Animal> {
    const animal = await this.animals.findById(id);
    if (!animal) throw new NotFoundError(`Animal ${id} not found`);
    return animal;
  }

  list(): Promise<Animal[]> {
    return this.animals.findAll();
  }

  async markReadyForAdoption(id: string, actor: string): Promise<Animal> {
    const updated = markReady(await this.get(id));
    await this.changes.commit([{ entityType: "animal", entity: updated }], actor);
    return updated;
  }
}
