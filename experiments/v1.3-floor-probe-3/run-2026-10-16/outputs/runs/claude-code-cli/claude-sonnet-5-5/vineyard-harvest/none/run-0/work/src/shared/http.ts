import type { NextFunction, Request, Response } from "express";
import { DomainError } from "./errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal error" });
}

export function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new DomainError(`${field} must be a non-empty string`);
  return v.trim();
}

export function num(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new DomainError(`${field} must be a number`);
  return v;
}

export function isoDate(v: unknown, field: string): string {
  const s = str(v, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new DomainError(`${field} must be a date as YYYY-MM-DD`);
  }
  return s;
}
