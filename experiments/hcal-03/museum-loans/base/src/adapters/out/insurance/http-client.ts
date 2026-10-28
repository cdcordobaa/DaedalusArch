export interface HttpClient {
  post(url: string, body: unknown): Promise<{ status: number; json: unknown }>;
}
