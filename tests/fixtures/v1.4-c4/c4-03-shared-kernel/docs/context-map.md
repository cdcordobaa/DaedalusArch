# Context map

- ordering: upstream. Owns orders, customers and prices.
- billing: downstream of ordering. Owns invoices.

## Shared kernel
Money is a shared kernel between ordering and billing: billing imports Money directly from ordering.
Any change to Money is agreed by both teams.
