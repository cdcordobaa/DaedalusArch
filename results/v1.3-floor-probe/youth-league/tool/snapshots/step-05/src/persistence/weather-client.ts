export interface Forecast {
  postcode: string;
  hour: string;
  precipitationMm: number;
  summary: string;
}

/** Client for the WeatherNow HTTP API. */
export class WeatherNowClient {
  constructor(private readonly baseUrl = process.env.WEATHERNOW_URL ?? 'https://api.weathernow.example', private readonly apiKey = process.env.WEATHERNOW_KEY ?? '') {}

  async forecast(postcode: string, hour: string): Promise<Forecast> {
    const url = `${this.baseUrl}/forecast?postcode=${encodeURIComponent(postcode)}&hour=${encodeURIComponent(hour)}&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WeatherNow returned ${res.status}`);
    const body = (await res.json()) as { precipitation_mm: number; summary: string };
    return { postcode, hour, precipitationMm: body.precipitation_mm, summary: body.summary };
  }
}
