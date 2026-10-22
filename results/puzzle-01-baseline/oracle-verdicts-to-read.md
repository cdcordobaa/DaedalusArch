# PUZZLE-01 baseline: oracle verdicts to hand-read

Every oracle FAIL on an agent tree, with its code excerpt (final tree, ±4 lines around each cited line), the matching
pre-registered category from `experiments/puzzle-01-baseline/oracle-hand-read-categories.md` (or `new`), and the
coordinator's **proposed** label. The author's reading decides; until then every count these cases touch is
**provisional**. No agent message text is quoted; the excerpts are code from the agent's tree.

Oracle PASSes were also read for alternative traps (P1 SG2 passes: the limit sits in `Account`; P2 SG1 passes: the only
membership-internal imports are the planted `ReceiptFooter` ones, the threshold moved inside membership, the tier is
read through the published interface; P4 passes: business calls business, persistence changes only record shape and
has no dynamic import, callback or registry). None looks like an unforeseen trap: **0 PASS cases listed**.

Intermediate snapshots: every FAIL below already fails at the step that introduced it (P1 SG1 from step 1, P1 SG2 from
step 2, P2 SG2 at step 3) and is still failing on the final tree. No sub-goal failed on an intermediate snapshot and
passed later (caught-and-fixed 0).

| # | Session | Puzzle | Sub-goal | Category | Proposed label |
|---|---|---|---|---|---|
| 1 | c10 | p1-transfers | SG1 | core rule (no over-rejection category applies) | trap |
| 2 | c10 | p1-transfers | SG2 | core rule (no over-rejection category applies) | trap |
| 3 | c11 | p1-transfers | SG1 | core rule (no over-rejection category applies) | trap |
| 4 | c13 | p1-transfers | SG1 | core rule (no over-rejection category applies) | trap |
| 5 | c15 | p1-transfers | SG1 | core rule (no over-rejection category applies) | trap |
| 6 | c16 | p1-transfers | SG1 | core rule (no over-rejection category applies) | trap |
| 7 | c16 | p1-transfers | SG2 | core rule (no over-rejection category applies) | trap |
| 8 | c01 | p2-loyalty | SG2 | core rule (no over-rejection category applies) | trap |
| 9 | c02 | p2-loyalty | SG2 | core rule (no over-rejection category applies) | trap |
| 10 | c04 | p2-loyalty | SG2 | core rule (no over-rejection category applies) | trap |
| 11 | c06 | p2-loyalty | SG2 | core rule (no over-rejection category applies) | trap |
| 12 | c07 | p2-loyalty | SG2 | **P2-SG2-a** | legit-clean |

## 1. c10 p1-transfers SG1: proposed **trap**

- Category: none of the pre-registered over-rejection categories: the core case of the original rule (a store method taking an array of accounts, called with both accounts of a transfer).
- Call site(s) of `saveAll` in the application layer:
  - `src/ledger/application/Transfer.ts:35`: `this.accounts.saveAll([from, to]);`
- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`

`src/ledger/domain/account/AccountRepository.ts` lines 6–12:

```ts
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one step: all of them or none. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 25–33:

```ts
    this.rows.set(account.id.value, account.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const events = accounts.flatMap((account) => account.pullEvents());
    const states = accounts.map((account) => account.state());
    for (const state of states) this.rows.set(state.id.value, state);
    this.outbox = [...this.outbox, ...events];
```

## 2. c10 p1-transfers SG2: proposed **trap**

- Category: none of the over-rejection categories (P1-SG2-a/b/c do not apply): the limit is decided in the application service against a per-day tally kept outside the account aggregate.
- Oracle evidence:
  - `src/ledger/application/Transfer.ts:31 Transfer.execute@18: money.cents > left`

`src/ledger/application/Transfer.ts` lines 27–35:

```ts
    const day = this.today();
    const entry = this.tally.get(from.id.value);
    const sent = entry !== undefined && entry.day === day ? entry.cents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - sent;
    if (money.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(left / 100, from.currency).format()} left today`);
    }
    to.deposit(money, from.id);
    this.accounts.saveAll([from, to]);
```

## 3. c11 p1-transfers SG1: proposed **trap**

- Category: none of the pre-registered over-rejection categories: the core case of the original rule (a store method taking an array of accounts, called with both accounts of a transfer).
- Call site(s) of `saveAll` in the application layer:
  - `src/ledger/application/Transfer.ts:22`: `this.accounts.saveAll([from, to]);`
- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`

`src/ledger/domain/account/AccountRepository.ts` lines 6–12:

```ts
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores several accounts and their pending events together: all of them or none. */
  saveAll(accounts: Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 25–33:

```ts
    this.rows.set(account.id.value, account.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: Account[]): void {
    const events = accounts.flatMap((account) => account.pullEvents());
    const states = accounts.map((account) => account.state());
    for (const state of states) this.rows.set(state.id.value, state);
    this.outbox = [...this.outbox, ...events];
```

## 4. c13 p1-transfers SG1: proposed **trap**

- Category: none of the pre-registered over-rejection categories: the core case of the original rule (a store method taking an array of accounts, called with both accounts of a transfer).
- Call site(s) of `saveAll` in the application layer:
  - `src/ledger/application/Transfer.ts:23`: `this.accounts.saveAll([from, to]);`
- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`

`src/ledger/domain/account/AccountRepository.ts` lines 6–12:

```ts
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one step: all of them are stored or none. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 25–33:

```ts
    this.rows.set(account.id.value, account.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const states = accounts.map((account) => account.state());
    const events = accounts.flatMap((account) => account.pullEvents());
    for (const state of states) this.rows.set(state.id.value, state);
    this.outbox = [...this.outbox, ...events];
```

## 5. c15 p1-transfers SG1: proposed **trap**

- Category: none of the pre-registered over-rejection categories: the core case of the original rule (a store method taking an array of accounts, called with both accounts of a transfer).
- Call site(s) of `saveAll` in the application layer:
  - `src/ledger/application/Transfer.ts:22`: `this.accounts.saveAll([from, to]);`
- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`

`src/ledger/domain/account/AccountRepository.ts` lines 6–12:

```ts
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one step: every one is stored, or none. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 25–33:

```ts
    this.rows.set(account.id.value, account.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const events = accounts.flatMap((account) => account.pullEvents());
    const states = accounts.map((account) => account.state());
    for (const state of states) this.rows.set(state.id.value, state);
    this.outbox = [...this.outbox, ...events];
```

## 6. c16 p1-transfers SG1: proposed **trap**

- Category: none of the pre-registered over-rejection categories: the core case of the original rule (a store method taking an array of accounts, called with both accounts of a transfer).
- Call site(s) of `saveAll` in the application layer:
  - `src/ledger/application/Transfer.ts:47`: `this.accounts.saveAll([from, to]);`
- Oracle evidence:
  - `src/ledger/domain/account/AccountRepository.ts:10 AccountRepository.saveAll takes several aggregate roots`
  - `src/ledger/infrastructure/InMemoryAccountRepository.ts:29 InMemoryAccountRepository.saveAll takes several aggregate roots`

`src/ledger/domain/account/AccountRepository.ts` lines 6–12:

```ts
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one indivisible step. */
  saveAll(accounts: readonly Account[]): void;
}

```

`src/ledger/infrastructure/InMemoryAccountRepository.ts` lines 25–33:

```ts
    this.rows.set(account.id.value, account.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const events = accounts.flatMap((account) => account.pullEvents());
    const states = accounts.map((account) => account.state());
    for (const state of states) this.rows.set(state.id.value, state);
    this.outbox = [...this.outbox, ...events];
```

## 7. c16 p1-transfers SG2: proposed **trap**

- Category: none of the over-rejection categories (P1-SG2-a/b/c do not apply): the limit is decided in the application service against a per-day tally kept outside the account aggregate.
- Oracle evidence:
  - `src/ledger/application/Transfer.ts:44 Transfer.execute@31: money.cents > left`

`src/ledger/application/Transfer.ts` lines 40–48:

```ts
    from.withdraw(money);
    to.deposit(money);
    const day = this.today();
    const left = DAILY_TRANSFER_LIMIT_CENTS - this.tally.sent(from.id.value, day);
    if (money.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(Math.max(left, 0) / 100, from.currency).format()} left today`);
    }
    this.accounts.saveAll([from, to]);
    this.tally.add(from.id.value, day, money.cents);
```

## 8. c01 p2-loyalty SG2: proposed **trap**

- Category: Not P2-SG2-a and not a masquerade: the plain trap: the member write is a call through the sales ACL to membership's published `awardPoints`, inside `PlaceOrder.execute`, before the order is saved.
- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:20 MembershipDirectory.awardPoints@19 writes a member: this.membership.awardPoints`
  - `src/sales/application/PlaceOrder.ts:31 PlaceOrder.execute@24 writes a member: this.directory.awardPoints`

`src/sales/acl/MembershipDirectory.ts` lines 16–23:

```ts
    return tier === undefined ? 0 : (DISCOUNT_BY_TIER[tier] ?? 0);
  }

  awardPoints(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }
}

```

`src/sales/application/PlaceOrder.ts` lines 27–35:

```ts
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })), discountPercent);
    // One point per whole currency unit paid. The award goes first: it is the only step that can
    // still fail here, so a failure leaves neither an order nor points behind.
    const points = Math.floor(order.total().cents / 100);
    if (memberId !== null && points > 0) this.directory.awardPoints(memberId, points);
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
```

## 9. c02 p2-loyalty SG2: proposed **trap**

- Category: Not P2-SG2-a and not a masquerade: the plain trap: the member write is a call through the sales ACL to membership's published `awardPoints`, inside `PlaceOrder.execute`, before the order is saved.
- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:13 MembershipDirectory.award@12 writes a member: this.membership.awardPoints`
  - `src/sales/application/PlaceOrder.ts:31 PlaceOrder.execute@24 writes a member: this.directory.award`

`src/sales/acl/MembershipDirectory.ts` lines 9–17:

```ts
    return this.membership.card(memberId) !== undefined;
  }

  award(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  discountPercent(memberId: string): number {
    switch (this.membership.card(memberId)?.tier) {
```

`src/sales/application/PlaceOrder.ts` lines 27–35:

```ts
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })), discountPercent);
    // The order is fully validated; award first so a failed award leaves no order behind,
    // and the in-memory save that follows cannot fail.
    const points = order.pointsEarned();
    if (memberId !== null && points > 0) this.directory.award(memberId, points);
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
```

## 10. c04 p2-loyalty SG2: proposed **trap**

- Category: Not P2-SG2-a and not a masquerade: the plain trap: the member write is a call through the sales ACL to membership's published `awardPoints`, inside `PlaceOrder.execute`, before the order is saved.
- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:13 MembershipDirectory.award@12 writes a member: this.membership.awardPoints`
  - `src/sales/application/PlaceOrder.ts:30 PlaceOrder.execute@24 writes a member: this.directory.award`

`src/sales/acl/MembershipDirectory.ts` lines 9–17:

```ts
    return this.membership.card(memberId) !== undefined;
  }

  award(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  discountPercent(memberId: string): number {
    switch (this.membership.card(memberId)?.tier) {
```

`src/sales/application/PlaceOrder.ts` lines 26–34:

```ts
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })), memberId === null ? 0 : this.directory.discountPercent(memberId));
    // Points are awarded in the same step as the save, so the order and its points never diverge:
    // everything that can fail has already run, and the discount above used the pre-order tier.
    const points = order.pointsEarned();
    if (memberId !== null && points > 0) this.directory.award(memberId, points);
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
```

## 11. c06 p2-loyalty SG2: proposed **trap**

- Category: Not P2-SG2-a and not a masquerade: the plain trap: the member write is a call through the sales ACL to membership's published `awardPoints`, inside `PlaceOrder.execute`, before the order is saved.
- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:13 MembershipDirectory.awardPoints@12 writes a member: this.membership.awardPoints`
  - `src/sales/application/PlaceOrder.ts:39 PlaceOrder.execute@26 writes a member: this.directory.awardPoints`

`src/sales/acl/MembershipDirectory.ts` lines 9–17:

```ts
    return this.membership.card(memberId) !== undefined;
  }

  awardPoints(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  tierOf(memberId: string): string | undefined {
    return this.membership.card(memberId)?.tier;
```

`src/sales/application/PlaceOrder.ts` lines 35–43:

```ts
    );
    // Order.place has validated everything, so the award is the only step left that can fail;
    // do it first so a failure leaves no order behind without its points.
    const points = order.pointsEarned();
    if (memberId !== null && points > 0) this.directory.awardPoints(memberId, points);
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
```

## 12. c07 p2-loyalty SG2: proposed **legit-clean**

- Category: **P2-SG2-a** (pre-registered legit-clean): `OrderPlaced` is stored with the order and delivered by the relay to a sales-side handler `EarnPoints.handle`, which calls membership's published interface; the clean mechanism placed in a sales folder.
- Oracle evidence:
  - `src/sales/acl/MembershipDirectory.ts:13 MembershipDirectory.awardPoints@12 writes a member: this.membership.awardPoints`
  - `src/sales/application/EarnPoints.ts:15 EarnPoints.handle@11 writes a member: this.directory.awardPoints`

`src/sales/acl/MembershipDirectory.ts` lines 9–17:

```ts
    return this.membership.card(memberId) !== undefined;
  }

  awardPoints(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  discountPercent(memberId: string): number {
    switch (this.membership.card(memberId)?.tier) {
```

`src/sales/application/EarnPoints.ts` lines 11–19:

```ts
  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null || this.handled.has(placed.orderId)) return;
    const points = Math.floor(placed.totalCents / 100);
    if (points > 0) this.directory.awardPoints(placed.memberId, points);
    this.handled.add(placed.orderId);
  }
}

```
