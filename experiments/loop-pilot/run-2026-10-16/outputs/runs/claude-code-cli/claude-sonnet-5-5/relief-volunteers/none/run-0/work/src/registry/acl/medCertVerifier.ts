import type { CertificateVerifier, Skill } from "../domain/volunteer.js";

/**
 * Anti-corruption layer over the MedCert HTTP API. Only first-aid certificates
 * are checked there. Anything other than an explicit confirmation (unknown
 * certificate, other status, error, timeout) counts as not confirmed.
 *
 * Assumed contract: GET {baseUrl}/certificates/{number} -> 200 {"status": "confirmed" | ...}
 */
export class MedCertVerifier implements CertificateVerifier {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {}

  async isConfirmed(skill: Skill, certificateNumber: string): Promise<boolean> {
    if (skill !== "first_aid") return true;
    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/certificates/${encodeURIComponent(certificateNumber)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) return false;
      const data: unknown = await res.json();
      if (typeof data !== "object" || data === null) return false;
      const status = (data as Record<string, unknown>)["status"];
      return typeof status === "string" && status.toLowerCase() === "confirmed";
    } catch {
      return false;
    }
  }
}
