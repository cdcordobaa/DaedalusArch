/** SDK clients of the third-party services, configured from the environment (left as thin HTTP stubs here). */
export interface ExternalClients {
  readonly randomUUID: () => string;
  readonly psp: {
    charge(request: { customer: string; amount: number; currency: string; metadata: Record<string, string> }): Promise<{ id: string; status: string }>;
    refund(request: { charge: string; amount: number }): Promise<void>;
  };
  readonly mailer: { send(to: string, template: string, data: Record<string, string>): Promise<void> };
  readonly tm: { analyse(pair: string, documentUrl: string): Promise<{ fuzzy85to100: number; exact: number }> };
}

export function externalClients(env: Record<string, string | undefined>): ExternalClients {
  const unavailable = (name: string) => (): Promise<never> => Promise.reject(new Error(`${name} is not configured (${env['NODE_ENV'] ?? 'dev'})`));
  let counter = 0;
  return {
    randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    psp: { charge: unavailable('PSP'), refund: unavailable('PSP') },
    mailer: { send: unavailable('mailer') },
    tm: { analyse: unavailable('translation memory') },
  };
}
