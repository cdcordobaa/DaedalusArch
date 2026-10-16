# v1.3 loop pilot tasks

**2026-10-15. Written before any pilot run.** These are the three tasks of the exploratory loop pilot (`Docs/v1.3/pilot-outcome-memo.md`). They are **not** Study 2 tasks. The Study 2 tasks stay sealed outside the repository (`Docs/v1.3/sealed-hashes.md`); this file was written without reading them.

## 1. How the tasks were chosen

- **New domains.** None of the domains is one of the reference apps (library loans, orders, workshop registrations, room booking, ordering and billing, expense reimbursement, course enrollment, support tickets, parcel tracking, insurance). None is an E1 task (`experiments/e1-grid/plan.json`: task-management, order-fulfilment) or the loop demo task (todo list).
- **Sealed-list check.** Before the pilot runs, the author checks that no pilot domain matches a sealed Study 2 domain, without writing down which domains those are. If one matches, that task is replaced, re-hashed and the memo updated, all before any run. One first-draft task (the Clean task) was replaced this way before any run; its domain is reserved for a later study.
- **Architectural pressure, not CRUD.** Step 1 builds the system and already contains one external integration. Each later step forces a design choice where the easy answer erodes the style. Across the three tasks the steps cover the four pressure kinds: a cross-module feature, a second adapter of a type that already exists, a reporting or shared-kernel feature that crosses contexts, and a change that cuts across every layer (multi-tenancy, audit logging).
- **Plain product language.** The requests describe features only. They never name a layer, a port, an interface or a pattern, so the pressure comes from the feature, not the wording. The target style reaches the agent only through the prompt frame and the evaluator spec (§3).
- **k = 4** steps per task.

## 2. The task text (hashed)

The JSON block below is exactly the content of the harness tasks file (`LoopTasksFile`, `scripts/lib/loop/types.ts`). Only this block is hashed. §3 and §4 are commentary for the author and are never shown to the agent.

```json
{
  "description": "v1.3 loop pilot tasks (exploratory, not Study 2). Defined in Docs/v1.3/pilot-tasks.md before any pilot run; hashed in Docs/v1.3/pilot-outcome-memo.md. Never to be used in Study 2.",
  "tasks": [
    {
      "id": "market-vendors",
      "title": "Farmers' market vendors",
      "steps": [
        {
          "id": "stalls",
          "request": "Create a service for a weekly farmers' market. The market organiser defines market days and the stall pitches of the market (number, size, with or without power). Vendors register (business name, contact, products sold) and book a pitch for a market day. A pitch is never booked twice for the same market day, and a vendor holds at most one pitch per market day. Shoppers pay at the stalls with card readers from PayLane, which the market provides; PayLane posts each card sale to a webhook as JSON with the reader id, the amount and the time. The organiser links each reader to a vendor for a market day. A sale from a reader that is not linked to a vendor with a booking on that day is rejected. The service lists each vendor's card sales per market day. Keep the data in memory and expose the operations over HTTP."
        },
        {
          "id": "fees-and-settlement",
          "request": "Add vendor fees and payouts. Each pitch size has a stall fee per market day, with a surcharge for power, and the market keeps a commission of every card sale (5% by default; the organiser can set a different rate per vendor). A vendor can cancel a booking up to 48 hours before the market day without paying the stall fee. After a market day is closed, the organiser runs its settlement: each vendor's payout is their card sales for the day minus the commission and the stall fee. A payout is never negative: what the vendor still owes is carried into their next settlement. A settled market day can no longer receive sales or booking changes."
        },
        {
          "id": "second-provider",
          "request": "Some vendors now bring their own card readers from TillWave instead of using PayLane. TillWave does not call us: the service must poll its HTTP API every 15 minutes for new sales. TillWave reports amounts in cents and identifies sellers by its own merchant ids, which the organiser links to vendors. Each vendor uses at most one provider on a market day. TillWave sales go through the same checks, the same commission and the same settlement as PayLane sales, and a sale reported twice is counted once."
        },
        {
          "id": "audit-and-statements",
          "request": "The market's accountant needs an audit log. Every change to a booking, a fee or commission rate, a card sale or a settlement is recorded with who made it (the organiser id from a request header, or 'system' for provider sales), when, and the values before and after. A change and its audit record are always saved together or not at all. The organiser can list the audit log of one market day, including the changes to its bookings, sales and settlement. Each vendor can download a monthly statement of their bookings, card sales per provider, fees, payouts and carried balance."
        }
      ]
    },
    {
      "id": "shelter-adoptions",
      "title": "Animal shelter adoptions",
      "steps": [
        {
          "id": "adoptions",
          "request": "Create a service for an animal shelter. Staff register animals (species, name, estimated age, intake date, medical notes) and mark them ready for adoption. Members of the public submit an adoption application for an animal, with their contact details and household information. Staff approve or reject an application. Approving one marks the animal adopted and rejects the animal's other open applications. The applicant gets an e-mail when an application is decided; for now, send e-mails through a fake mail provider that records the messages. Keep the data in memory and expose the operations over HTTP."
        },
        {
          "id": "fostering",
          "request": "Add a foster network. Volunteers sign up as foster carers, with the number and the species of animals they can host. Staff place an animal with a carer and end the placement. A carer never hosts more animals than their capacity. An animal in foster care can still be adopted: approving its adoption ends the placement and e-mails the carer."
        },
        {
          "id": "sms",
          "request": "Applicants and carers can now choose to be notified by SMS instead of e-mail. SMS messages go through TextBridge: its HTTP API takes a phone number and a text of at most 160 characters, and it reports each message's delivery later, by calling a webhook of ours. When TextBridge reports a failed delivery, the same notification is sent by e-mail instead. Staff can see the delivery status of every notification."
        },
        {
          "id": "audit-trail",
          "request": "The shelter needs an audit trail for its licence inspections. Every change to an animal, an application, a foster placement or a notification's delivery status is recorded with who made it (the staff member id from a request header, or 'system' for webhooks), when, and the values before and after. Staff can list the audit trail of one animal, including the changes to its applications and placements, and list every change one staff member made in a date range. A change and its audit record are always saved together or not at all."
        }
      ]
    },
    {
      "id": "relief-volunteers",
      "title": "Disaster-relief volunteer coordination",
      "steps": [
        {
          "id": "registry-and-shifts",
          "request": "Create a service for a disaster-relief organisation. It has two parts, run by different teams. The volunteer registry keeps volunteers (name, contact, home region) and their skills (first aid, heavy machinery, logistics, translation); a skill may need a certification with a number and an expiry date. First-aid certificates are verified with the MedCert HTTP API by certificate number; a certification its issuer has not confirmed counts as missing. Deployment planning keeps incidents (name, region, start date) and the shifts each incident needs (date, hours, required skill, number of people). A coordinator assigns volunteers to shifts. A shift never has more people than it needs, and a volunteer is never on two overlapping shifts. Keep the data in memory and expose the operations over HTTP."
        },
        {
          "id": "qualified-assignments",
          "request": "A volunteer may only be assigned to a shift whose required skill they hold, with a certification that is valid on the shift's date. When a certification expires or is withdrawn, the volunteer's future shifts that need it are released and show as open again. Add a list of the open shifts of an incident, with the volunteers who could fill each one."
        },
        {
          "id": "licence-registry",
          "request": "Heavy-machinery licences must now be verified too. The national licence registry has no API: it publishes a CSV file of the valid licence numbers once a day at a fixed URL, which the service downloads. A heavy-machinery certification is valid only while its number is in the latest file. Re-verify every certification, of either kind, once a day."
        },
        {
          "id": "impact-report",
          "request": "Funders now require a monthly impact report: for each incident and region, the hours served per skill, the number of distinct volunteers and the share of shift places filled, with the volunteers also counted by home region. Each volunteer can also download a record of their own service hours, showing the certification each shift relied on. The registry and deployment planning must use the same volunteer identifiers and the same skill names."
        }
      ]
    }
  ]
}
```

## 3. Target style per task

| Task | Style | Evaluator spec | Style sentence in the prompt frame |
|---|---|---|---|
| `market-vendors` | Clean Architecture | `specs/clean-arch.yaml` (the E1 spec) | "Organise the code following Clean Architecture." (the current frame) |
| `shelter-adoptions` | Hexagonal | a pilot spec built on `presets/hexagonal.yaml` | "Organise the code following Hexagonal Architecture (ports and adapters)." |
| `relief-volunteers` | DDD | a pilot spec built on `presets/ddd.yaml`, declaring two bounded contexts, `src/registry/` and `src/deployment/` | "Organise the code following Domain-Driven Design, with one bounded context per part: src/registry/ for the volunteer registry and src/deployment/ for deployment planning." |

**Harness gap, to close before the pilot.** `scripts/lib/loop/prompts.ts` writes "Clean Architecture" into both step frames, and a loop plan takes one `evaluatorSpec`. The pilot therefore needs either a per-task style sentence and spec, or three plans (one per style) with a style slot in the frame. The two pilot specs and the frame change are written, hashed and recorded in the memo (§7) before any run. The DDD spec declares only the two contexts. Whether the agent puts shared code in an undeclared folder at step 4 is part of the pressure (FF-DS01; see construct question Q15).

## 4. Where erosion is tempting (commentary, not shown to the agent)

| Task, step | Pressure kind | The tempting shortcut | What the tool would see |
|---|---|---|---|
| market 1 | first adapter | Parse the PayLane JSON inside the sale-recording use case or the entity; booking checks in the controller. | Domain or application importing an HTTP or vendor module (FF-S01, FF-S04, FF-P01). |
| market 2 | cross-module | The settlement code reads bookings and sales stores directly, edits booking state, or the booking, sales and settlement modules import each other. | Cycles (FF-S02); outward edges if the fee and settlement rules sit in a controller. |
| market 3 | second adapter | `if (provider === 'tillwave')` with the cents conversion in the use case or the domain; a poller that writes to the repository and skips the checks and de-duplication. | Infrastructure types in the core (FF-S01, FF-S04); a scheduler importing the concrete repository (FF-P03); duplicated sale logic. |
| market 4 | across every layer | Audit writes inside each controller or repository; the organiser id read from the request deep inside use cases; entities importing a logger or request context; the statement querying every repository directly. | Domain imports from infrastructure or HTTP (FF-S04, FF-P01); constructor injection of concrete classes (FF-P06). |
| shelter 1 | first adapter | The approval use case calls the fake mail class directly. | Application to adapter edge (dependency-direction-graph, core-isolation); adapter with no port (port-adapter-pattern). |
| shelter 2 | cross-module | Adoption approval reaching into the foster store, or the foster code calling the mail class directly. | Core-to-adapter edges; cycles between the two features. |
| shelter 3 | second adapter | Branching on the channel in the use case; the TextBridge webhook handler calling the e-mail adapter for the fallback (adapter to adapter). | Adapter-to-adapter edges (construct question Q5); a second notifier that implements no port. |
| shelter 4 | across every layer | Audit writes inside each adapter or controller; the domain importing a logger or the request header. | Core importing adapters (core-isolation); framework packages in the domain (FF-P01). |
| relief 1 | first adapter, two contexts | Deployment importing registry entities to check skills; the MedCert client in the registry domain. | Cross-context internal imports (FF-DS02); framework or HTTP code in the domain (FF-DT04). |
| relief 2 | cross-context | Assignment rules reading registry repositories or entities directly instead of a published interface or a translation. | FF-DS02; aggregate-boundary breaks if a certification is reached past its volunteer root (FF-DT01). |
| relief 3 | second adapter | The CSV download and parsing placed beside the MedCert client in the domain, or a `kind` switch in the certification entity. | Infrastructure in the domain (FF-DT04); mutable certification value objects (FF-DT03). |
| relief 4 | shared kernel and reporting | A `shared/` or `common/` folder outside both contexts; the report importing both contexts' repositories and entities. | Files outside every declared context (FF-DS01); cross-context imports (FF-DS02). |

The "what the tool would see" column is a guess for planning. It is not an outcome, and nothing is scored against it.

## 5. Reproducing the hashes

The hashes are recorded in `Docs/v1.3/pilot-outcome-memo.md` §7. Each task's hash is the sha256 of `JSON.stringify(task)`, compact, in the key order of the block. The block hash is the sha256 of the text between the opening `json` fence line of §2 and its closing fence, without either fence line.

```bash
node -e '
const md = require("fs").readFileSync("Docs/v1.3/pilot-tasks.md", "utf8");
const block = /```json\n([\s\S]*?)```/.exec(md)[1];
const sha = (t) => require("crypto").createHash("sha256").update(t, "utf8").digest("hex");
console.log("block", sha(block));
for (const t of JSON.parse(block).tasks) console.log(t.id, sha(JSON.stringify(t)));'
```
