import { Request } from 'express';
export function actorOf(req: Request): string { return req.header('x-staff-id') ?? 'system'; }
