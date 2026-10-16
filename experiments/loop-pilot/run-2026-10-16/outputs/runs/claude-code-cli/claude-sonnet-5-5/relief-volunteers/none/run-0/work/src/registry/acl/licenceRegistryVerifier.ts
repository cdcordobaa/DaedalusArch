import type { CertificateVerifier, Skill } from "../domain/volunteer.js";

/**
 * Anti-corruption layer over the national heavy-machinery licence registry,
 * which has no API: it publishes a CSV of valid licence numbers at a fixed URL
 * once a day. A licence is confirmed only while its number is in the latest
 * successfully downloaded file; before the first download nothing is confirmed.
 * A failed refresh keeps the previous file.
 *
 * Assumed format: one licence number per line, in the first column; an optional
 * header row is harmless.
 */
export class LicenceRegistryVerifier implements CertificateVerifier {
  private valid: Set<string> | undefined;

  constructor(
    private readonly url: string,
    private readonly timeoutMs = 15000,
  ) {}

  async refresh(): Promise<void> {
    try {
      const res = await fetch(this.url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) return;
      this.valid = parseLicenceCsv(await res.text());
    } catch {
      // keep the previous file
    }
  }

  async isConfirmed(skill: Skill, certificateNumber: string): Promise<boolean> {
    if (skill !== "heavy_machinery") return true;
    if (!this.valid) await this.refresh();
    return this.valid?.has(certificateNumber.trim()) ?? false;
  }
}

export function parseLicenceCsv(text: string): Set<string> {
  const out = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const first = (line.split(",")[0] ?? "").trim().replace(/^"(.*)"$/, "$1").trim();
    if (first) out.add(first);
  }
  return out;
}
