// IO4: environment read in an application service (env, advisory).
// IO5: outbound HTTP through the global fetch, no import (http-out, blocking).
export class PaymentService {
  async charge(cents: number): Promise<boolean> {
    const key = process.env.STRIPE_KEY ?? '';
    const res = await fetch('https://api.example.test/charge', { method: 'POST', body: JSON.stringify({ cents, key }) });
    return res.ok;
  }
}

