import { Request, Response } from 'express';
import { MembersService } from '../../services/members.service';
import { registerMemberRequest } from '../requests';

export class MembersController {
  constructor(private readonly members: MembersService) {}

  async register(req: Request, res: Response): Promise<void> {
    const input = registerMemberRequest(req.body);
    const member = await this.members.register(input.fullName, input.email, input.company);
    res.status(201).json(member);
  }

  async findOne(req: Request, res: Response): Promise<void> {
    res.json(await this.members.findOne(req.params.id));
  }

  async byCompany(req: Request, res: Response): Promise<void> {
    res.json(await this.members.byCompany(req.query.company ?? ''));
  }
}
