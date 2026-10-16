import { Request, Response } from 'express';
import { MembershipsService } from '../../services/memberships.service';
import { fieldsOf, text } from '../parse';
import { pauseMembershipRequest, startMembershipRequest } from '../requests';

export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  async start(req: Request, res: Response): Promise<void> {
    const input = startMembershipRequest(req.body);
    const membership = await this.memberships.start(input.memberId, input.planCode, input.startsOn);
    res.status(201).json(membership);
  }

  async pause(req: Request, res: Response): Promise<void> {
    const input = pauseMembershipRequest(req.body);
    res.json(await this.memberships.pause(req.params.id, input.weeks, input.reason));
  }

  async resume(req: Request, res: Response): Promise<void> {
    res.json(await this.memberships.resume(req.params.id));
  }

  async cancel(req: Request, res: Response): Promise<void> {
    const effectiveOn = text(fieldsOf(req.body), 'effectiveOn');
    res.json(await this.memberships.cancel(req.params.id, effectiveOn));
  }
}
