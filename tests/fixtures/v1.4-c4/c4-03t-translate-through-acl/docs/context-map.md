# Context map

- ordering: upstream. Owns orders, customers and prices.
- billing: downstream of ordering. Owns invoices.

## Translation
Money is not shared between the contexts: billing must translate Money through its ACL (src/billing/acl/) and never import it from ordering.
There is no shared kernel.
