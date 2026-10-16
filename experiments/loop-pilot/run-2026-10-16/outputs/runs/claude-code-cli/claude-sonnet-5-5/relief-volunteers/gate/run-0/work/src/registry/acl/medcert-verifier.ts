import { CertificateVerifier } from "../domain/ports";

/**
 * Anti-corruption layer over the external MedCert HTTP API.
 * Calls GET {baseUrl}/certificates/{number} and translates its payload into a boolean.
 * Anything other than an explicit confirmation (404, errors, timeouts, unknown payloads)
 * is treated as "not confirmed", i.e. the certification is missing.
 */
export class MedCertVerifier implements CertificateVerifier {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {}

  async isConfirmed(certificateNumber: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/certificates/${encodeURIComponent(certificateNumber)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return false;
      const data: unknown = await res.json();
      if (typeof data !== "object" || data === null) return false;
      const d = data as Record<string, unknown>;
      if (d.confirmed === true || d.valid === true || d.verified === true) return true;
      return typeof d.status === "string" && ["confirmed", "valid", "verified", "active"].includes(d.status.toLowerCase());
    } catch {
      return false;
    }
  }
}
