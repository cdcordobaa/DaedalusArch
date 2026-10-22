## c04 p1-transfers SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/ledger/domain/account/AccountRepository.ts` lines 7–12:

```ts
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one step: all are stored or none. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 26–32:

```ts
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const states = accounts.map((account) => account.state());
    const events = accounts.flatMap((account) => account.pullEvents());
    states.forEach((state) => this.rows.set(state.id.value, state));
```

## c08 p1-transfers SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/ledger/domain/account/AccountRepository.ts` lines 7–12:

```ts
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one step: all are stored or none. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 26–32:

```ts
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const rows = accounts.map((a) => [a.id.value, a.state()] as const);
    const events = accounts.flatMap((a) => a.pullEvents());
    for (const [id, row] of rows) this.rows.set(id, row);
```

## c11 p1-transfers SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/ledger/domain/account/AccountRepository.ts` lines 7–12:

```ts
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores several accounts and their pending events in one step: all are stored or none. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 26–32:

```ts
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const events = accounts.flatMap((account) => account.pullEvents());
    const states = accounts.map((account) => account.state());
    for (const state of states) this.rows.set(state.id.value, state);
```

## c09 p2-loyalty SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/sales/application/CreditPoints.ts:11 CreditPoints.handle@9 compares points: placed.pointsEarned <= 0`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/sales/application/CreditPoints.ts` lines 8–14:

```ts

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null || placed.pointsEarned <= 0) return;
    this.directory.awardPoints(placed.memberId, placed.pointsEarned);
  }
}
```

## c09 p2-loyalty SG2 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:13 MembershipDirectory.awardPoints@12 writes a member: this.membership.awardPoints`
  - `src/sales/application/CreditPoints.ts:12 CreditPoints.handle@9 writes a member: this.directory.awardPoints`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/sales/acl/MembershipDirectory.ts` lines 10–16:

```ts
  }

  awardPoints(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  describe(memberId: string): { readonly name: string; readonly points: number } | undefined {
```

`src/sales/application/CreditPoints.ts` lines 9–15:

```ts
  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null || placed.pointsEarned <= 0) return;
    this.directory.awardPoints(placed.memberId, placed.pointsEarned);
  }
}

```

## c16 p2-loyalty SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/sales/application/AwardOrderPoints.ts:11 AwardOrderPoints.handle@9 compares points: placed.pointsEarned <= 0`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/sales/application/AwardOrderPoints.ts` lines 8–14:

```ts

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null || placed.pointsEarned <= 0) return;
    this.directory.awardPoints(placed.memberId, placed.pointsEarned);
  }
}
```

## c16 p2-loyalty SG2 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:13 MembershipDirectory.awardPoints@12 writes a member: this.membership.awardPoints`
  - `src/sales/application/AwardOrderPoints.ts:12 AwardOrderPoints.handle@9 writes a member: this.directory.awardPoints`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/sales/acl/MembershipDirectory.ts` lines 10–16:

```ts
  }

  awardPoints(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  discountPercent(memberId: string): number {
```

`src/sales/application/AwardOrderPoints.ts` lines 9–15:

```ts
  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null || placed.pointsEarned <= 0) return;
    this.directory.awardPoints(placed.memberId, placed.pointsEarned);
  }
}

```

## c18 p2-loyalty SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/sales/application/PlaceOrder.ts:35 PlaceOrder.discountPercentFor@33 asks a MemberDirectory for its tier`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/sales/application/PlaceOrder.ts` lines 32–38:

```ts

  private discountPercentFor(memberId: string | null): number {
    if (memberId === null) return 0;
    const tier = this.directory.tier(memberId);
    return tier === undefined ? 0 : (TIER_DISCOUNT_PERCENT[tier] ?? 0);
  }
}
```

## c01 p3r-shipping-quotes functional failure

- Failing tests: `when the carrier is down the quote comes from our table, marked estimated`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

## c12 p3r-shipping-quotes functional failure

- Failing tests: `when the carrier is down the quote comes from our table, marked estimated`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

## c22 p3r-shipping-quotes SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/application/ports/out/RatePort.ts:5 vendor symbol FastshipRate`
  - `src/application/services/QuoteShipmentService.ts:29 vendor symbol serviceCode`
  - `src/application/services/QuoteShipmentService.ts:29 vendor code 'FREIGHT'`
  - `src/application/services/QuoteShipmentService.ts:30 vendor symbol amount`
  - `src/application/services/QuoteShipmentService.ts:30 vendor symbol value`
  - `src/application/services/QuoteShipmentService.ts:32 vendor symbol amount`
  - `src/application/services/QuoteShipmentService.ts:32 vendor symbol currency`
  - `src/application/services/QuoteShipmentService.ts:33 vendor symbol serviceName`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/application/ports/out/RatePort.ts` lines 2–7:

```ts
import type { Parcel } from '../../../domain/model/Parcel';

export interface RatePort {
  rates(parcel: Parcel): Promise<FastshipRate[]>;
}

```

`src/application/services/QuoteShipmentService.ts` lines 26–32:

```ts
    let cheapest: { price: Money; service: string } | undefined;
    const freightOnly = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    for (const rate of rates) {
      if ((rate.serviceCode === 'FREIGHT') !== freightOnly) continue;
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      const price = Money.of(value, rate.amount.currency);
```

`src/application/services/QuoteShipmentService.ts` lines 27–33:

```ts
    const freightOnly = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    for (const rate of rates) {
      if ((rate.serviceCode === 'FREIGHT') !== freightOnly) continue;
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      const price = Money.of(value, rate.amount.currency);
      if (!cheapest || price.isLessThan(cheapest.price)) cheapest = { price, service: rate.serviceName };
```

## c23 p3r-shipping-quotes SG1 (oracle FAIL; tests pass)

- Oracle evidence:
  - `src/application/ports/out/RatePort.ts:5 vendor symbol FastshipRate`
  - `src/application/services/QuoteShipmentService.ts:30 vendor symbol serviceCode`
  - `src/application/services/QuoteShipmentService.ts:30 vendor code 'FREIGHT'`
  - `src/application/services/QuoteShipmentService.ts:33 vendor symbol amount`
  - `src/application/services/QuoteShipmentService.ts:33 vendor symbol value`
  - `src/application/services/QuoteShipmentService.ts:33 vendor symbol currency`
  - `src/application/services/QuoteShipmentService.ts:38 vendor symbol serviceName`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)

`src/application/ports/out/RatePort.ts` lines 2–7:

```ts
import type { Parcel } from '../../../domain/model/Parcel';

export interface RatePort {
  rates(parcel: Parcel): Promise<FastshipRate[]>;
}

```

`src/application/services/QuoteShipmentService.ts` lines 27–33:

```ts
      return { amount: q.price.amount(), currency: q.price.currency, service: q.service, estimated: true };
    }
    const freight = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    const allowed = rates.filter((rate) => (rate.serviceCode === 'FREIGHT') === freight);
    const priced = allowed.map((rate) => ({
      rate,
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
```

`src/application/services/QuoteShipmentService.ts` lines 30–36:

```ts
    const allowed = rates.filter((rate) => (rate.serviceCode === 'FREIGHT') === freight);
    const priced = allowed.map((rate) => ({
      rate,
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
    }));
    if (priced.length === 0) throw new QuoteUnavailableError('no Fastship service for this parcel');
    const cheapest = priced.reduce((best, p) => (p.price.isLessThan(best.price) ? p : best));
```

## c24 p3r-shipping-quotes functional failure

- Failing tests: `when the carrier is down the quote comes from our table, marked estimated`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

## c05 p5-ferry-seats functional failure

- Failing tests: `bookings on a cancelled sailing show it, and new bookings on it are rejected`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

## c07 p5-ferry-seats SG2 (oracle FAIL; functional failure)

- Oracle evidence:
  - `cancelBooking: Sailing.release (sailings) changed with no event delivery on the stack`
  - `cancelBooking: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack`
- Checks on the final tree: none
- Category: (hand read)
- Proposed label: (hand read)


## c07 p5-ferry-seats functional failure

- Failing tests: `bookings on a cancelled sailing show it, and new bookings on it are rejected`
- Oracle: SG1 pass, SG2 FAIL
- Category: (hand read)

## c10 p5-ferry-seats functional failure

- Failing tests: `bookings on a cancelled sailing show it, and new bookings on it are rejected`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

## c17 p5-ferry-seats functional failure

- Failing tests: `bookings on a cancelled sailing show it, and new bookings on it are rejected`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

## c21 p5-ferry-seats functional failure

- Failing tests: `bookings on a cancelled sailing show it, and new bookings on it are rejected`
- Oracle: SG1 pass, SG2 pass
- Category: (hand read)

