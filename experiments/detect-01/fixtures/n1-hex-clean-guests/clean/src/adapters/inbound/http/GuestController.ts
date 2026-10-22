import type { RegisterGuestService } from '../../../application/services/RegisterGuestService';

export class GuestController {
  constructor(private readonly register: RegisterGuestService) {}

  async post(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
    const view = await this.register.register(String(body['name'] ?? ''), String(body['email'] ?? ''));
    return { status: 201, body: view };
  }
}
