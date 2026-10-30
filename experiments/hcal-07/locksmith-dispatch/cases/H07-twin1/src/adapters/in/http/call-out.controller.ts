import { HttpRequest, HttpResponse, json } from 'http-kit';
import { DispatchCallOutPort } from '../../../application/ports/in/dispatch-call-out.port';
import { CallOutNotFoundError, CallOutNotRequestedError, NoTechnicianFreeError } from '../../../domain/errors';

export class CallOutController {
  constructor(private readonly dispatchCallOut: DispatchCallOutPort) {}

  async postDispatch(req: HttpRequest): Promise<HttpResponse> {
    const callOutId = req.params['id'] ?? '';
    try {
      const result = await this.dispatchCallOut.dispatch({ callOutId });
      return json(201, result);
    } catch (e) {
      if (e instanceof CallOutNotFoundError) return json(404, { error: e.message });
      if (e instanceof NoTechnicianFreeError || e instanceof CallOutNotRequestedError) return json(409, { error: e.message });
      throw e;
    }
  }
}
