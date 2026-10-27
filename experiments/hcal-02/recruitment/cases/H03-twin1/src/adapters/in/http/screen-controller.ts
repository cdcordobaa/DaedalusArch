import { ScreenApplication } from "../../../application/ports/in/screen-application";
import { HttpResponse, mapError } from "./http-errors";

export class ScreenController {
  constructor(private readonly screen: ScreenApplication) {}

  async postScreening(req: { readonly params: { readonly applicationId: string } }): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.screen.execute(req.params.applicationId) };
    } catch (e) {
      return mapError(e);
    }
  }
}
