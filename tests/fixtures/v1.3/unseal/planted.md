# Made-up unsealer fixture (not a study task)

Planted structure words for `tests/unit/scripts/v1.3/unseal.test.ts`. No domain here is a study domain.

```json
{
  "description": "Unsealer fixture with planted terms. Made up for the test; never a study task.",
  "tasks": [
    {
      "id": "kite-club",
      "title": "Kite club lessons",
      "steps": [
        { "id": "clean", "request": "Create a service for a kite club. Members book lessons with an instructor; a lesson has at most six members. Keep the data in memory and expose the operations over HTTP." },
        { "id": "planted-banned", "request": "Put the booking rules in a Use-Case and keep each Entity pure; the weather feed goes behind a port with an adapter, following Hexagonal ideas and the repository pattern." },
        { "id": "planted-review", "request": "Members pay through the PayKite REST API, and the club's application form asks for the member's business name and an emergency contact; the config of each lesson lists the kites." }
      ]
    },
    {
      "id": "seed-bank",
      "title": "Seed bank with Clean Architecture",
      "steps": [
        { "id": "allowed-only", "request": "Gardeners register with a domain name for their club page and say whether they are a legal entity. Packets of seeds are lent and returned." },
        { "id": "plurals-and-glue", "request": "List the entities, ports and usecases of the lending module (DDD-style), and add a presentation-layer report." }
      ]
    }
  ]
}
```
