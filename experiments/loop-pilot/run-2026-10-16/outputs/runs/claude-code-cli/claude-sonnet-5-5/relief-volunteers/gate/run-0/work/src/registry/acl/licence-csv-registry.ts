import { LicenceRegistry } from "../domain/ports";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Anti-corruption layer over the national licence registry, which only publishes a CSV of valid
 * licence numbers at a fixed URL once a day. The latest successfully downloaded file is cached;
 * a number is valid only while it appears in that file. Before any successful download nothing is valid.
 */
export class CsvLicenceRegistry implements LicenceRegistry {
  private listed: Set<string> | undefined;
  private loadedAt = 0;
  private inflight: Promise<void> | undefined;

  constructor(
    private readonly url: string,
    private readonly timeoutMs = 10000,
  ) {}

  refresh(): Promise<void> {
    this.inflight ??= this.download().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  async isListed(licenceNumber: string): Promise<boolean> {
    if (!this.listed || Date.now() - this.loadedAt > DAY_MS) await this.refresh();
    return this.listed?.has(licenceNumber.trim()) ?? false;
  }

  private async download(): Promise<void> {
    try {
      const res = await fetch(this.url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) return;
      this.listed = parseCsv(await res.text());
      this.loadedAt = Date.now();
    } catch {
      // keep the previous list; an unreachable registry never validates anything new
    }
  }
}

function parseCsv(text: string): Set<string> {
  const out = new Set<string>();
  text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const first = line.split(",")[0].trim().replace(/^"|"$/g, "").trim();
      if (!first) return;
      if (i === 0 && /licen[cs]e|number/i.test(first)) return; // header row
      out.add(first);
    });
  return out;
}
