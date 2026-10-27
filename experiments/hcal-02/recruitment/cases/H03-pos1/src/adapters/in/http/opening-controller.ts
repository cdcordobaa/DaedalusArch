import { ApplyToOpening } from "../../../application/ports/in/apply-to-opening";
import { HttpResponse, mapError } from "./http-errors";
import { InMemoryOpeningRepository } from "../../out/persistence/in-memory-repositories";

export interface ApplyRequest {
  readonly params: { readonly openingId: string };
  readonly body: { readonly name?: unknown; readonly email?: unknown; readonly yearsExperience?: unknown };
}

export class OpeningController {
  private readonly known = new InMemoryOpeningRepository();

  constructor(private readonly apply: ApplyToOpening) {}

  async knows(openingId: string): Promise<boolean> {
    return (await this.known.findById(openingId)) !== null;
  }

  async postApplication(req: ApplyRequest): Promise<HttpResponse> {
    const { name, email, yearsExperience } = req.body;
    if (typeof name !== "string" || typeof email !== "string" || typeof yearsExperience !== "number") {
      return { status: 400, body: { message: "malformed body" } };
    }
    try {
      const result = await this.apply.execute({ openingId: req.params.openingId, name, email, yearsExperience });
      return { status: 201, body: result };
    } catch (e) {
      return mapError(e);
    }
  }
}
