import { HttpReply, replyOf } from '../shared/reply';

export class HealthController {
  get(): HttpReply {
    return replyOf(200, { ok: true });
  }
}
