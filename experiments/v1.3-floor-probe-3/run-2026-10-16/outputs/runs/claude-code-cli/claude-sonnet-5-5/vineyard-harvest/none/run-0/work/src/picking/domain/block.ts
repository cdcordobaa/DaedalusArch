import { DomainError } from "../../shared/errors.js";

export interface Block {
  readonly id: string;
  readonly name: string;
  readonly grapeVariety: string;
  readonly areaHectares: number;
}

export function newBlock(id: string, name: string, grapeVariety: string, areaHectares: number): Block {
  if (areaHectares <= 0) throw new DomainError("area must be positive");
  return { id, name, grapeVariety, areaHectares };
}
