import { ApplyToOpening } from "../../../application/ports/in/apply-to-opening";
import { HttpResponse, mapError } from "./http-errors";

export interface ApplyRequest {
  readonly params: { readonly openingId: string };
  readonly body: { readonly name?: unknown; readonly email?: unknown; readonly yearsExperience?: unknown };
}

export class OpeningController {
  constructor(private readonly apply: ApplyToOpening) {}

  async postApplication(req: ApplyRequest): Promise<HttpResponse> {
    const { name, email, yearsExperience } = req.body;
    if (typeof name !== "string" || typeof email !== "string" || typeof yearsExperience !== "number") {
      return { status: 400, body: { message: "malformed body" } };
    }
    if (yearsExperience < 2) {
      return { status: 422, body: { message: "minimum two years of experience required" } };
    }
    try {
      const result = await this.apply.execute({ openingId: req.params.openingId, name, email, yearsExperience });
      return { status: 201, body: result };
    } catch (e) {
      return mapError(e);
    }
  }
}
