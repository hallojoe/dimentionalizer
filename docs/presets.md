# Structure presets

Choose **Presets** in the header, filter by category, then **Open editable preset**. The document opens in Configure as a draft. Review or change it, then choose **Apply configuration** to replace the active architecture. Closing the editor keeps the active configuration unchanged. Export the current configuration first if you want to retain a separate copy before applying another one.

Presets use the existing version 1 document format. All normal controls work after applying one: group focus, object inspection, connection navigation, search, type filtering, view options, JSON import/export, and browser-local saving. No separate preset renderer or backend is involved. Preset loading also works in the WebGL fallback directory.

The 22 presets are grouped into **Planning & learning**, **Home & family**, **Work & study**, **Travel & mobility**, **Business & workflows**, **Infrastructure**, and **Repository snapshots**. To add a preset without replacing the current document, use **Spaces → Add a space → A preset template**.

## Included setups

| Preset | What it illustrates |
| --- | --- |
| A whole day, outside and inside | A morning-to-night overview, detailed workday portal, interruption branches, elevations, and saved checklists |
| An application through many reviewers | Six review instances, clarification/rework, approval or decline, participation, and reflection |
| One request across service instances | Alternative application instances, workers, shared data, retry and investigation at different elevations |
| Plan a household week | Commitments, ownership, meals, work, home tasks, downtime, replanning, and reflection |
| Home and neighborhood | A family, shop, bus, and Home portal leading to living, sleeping, and bathroom spaces |
| Family morning | Waking, washing, breakfast, study, and departure with everyday people and furniture |
| A CV in layers · 16 years | Six employment planes rising by start year across 2010–2025, grouped responsibilities, and three concurrent private businesses; see [CV walkthrough](career-cv.md) |
| Outside and inside the office | Campus and Office portal, workstations, partitions, lounge, and shared facilities |
| Daily commute | Human, home, bus, train, office, and visually distinct in/out transport capacities |
| Family trip | Family, airport bus, airplane, and an accommodation portal with beds and facilities |
| Email login and delivery | Key, envelope, and response models; independent return models and smooth spawn/arrival animations |
| Three-tier web application | Browser/CDN, proxy, application, relational database, cache, files, worker and e-mail |
| Multi-tenant SaaS | Tenant clients, shared tenant-aware API/data, external identity and billing, background notifications |
| E-commerce platform | Storefront, catalog, cart, checkout, payment callbacks, transactional outbox, fulfillment |
| Background job processing | Job API, scheduler, competing workers, delayed retries, dead letters, input and output storage |
| Headless content publishing | Authoring, published content API, independent delivery frontend, media CDN, publication processing |
| Real-time collaboration | Web/mobile clients, WebSocket ingress, two servers, presence, durable messages, per-instance fan-out |
| Analytics data pipeline | Operational events and extracts, raw storage, transformation, quarantine, warehouse and dashboards |
| Umbraco local Cluster | Source-grounded snapshot of the linked repository's checked-in demo |
| Retail operations | Customers, loyalty members, products, shop, warehouse, fulfillment, and a custom glTF parcel locker across three planes |
| Event launch | Organizers, attendees, event, ticket shop, registration, e-mail, and Slack-style notifications |
| Order approval workflow | Request, validation, custom Approval type, human review, API call, webhook, response, event, and dataflow |

The Infrastructure presets are illustrative reference architectures, not claims about a particular deployment or production-readiness guarantees. Components can be consolidated, renamed, or replaced to match your real system. Their descriptions call out logical components and relevant assumptions. For example, a replayable event stream is represented as a generic Container rather than pretending it is a work queue.

The business/workflow and human-situation examples are illustrative models. Transport capacities are examples, not measured schedules or service capacities. Portal examples keep the outside space visible and dimmed while the interior comes into focus. Email, Slack, webhooks, and API calls are visual nodes; no integrations execute. Retail operations loads its original model from `models/parcel-locker.gltf`; the others need no model assets. Existing infrastructure presets retain their original types and relationships.

## Umbraco source and scope

Repository: [hallojoe/umbraco-topology](https://github.com/hallojoe/umbraco-topology).

Snapshot: [`3ce66024ac9e5dc603d42185001656c092a5b425`](https://github.com/hallojoe/umbraco-topology/tree/3ce66024ac9e5dc603d42185001656c092a5b425/demo/Example.UmbracoSite).

The preset models **`demo/Example.UmbracoSite`, in Cluster mode**. The template's default provider options differ from this generated demo; this preset follows the checked-in demo source:

- One CM (`SchedulingPublisher`) and two CDs (`Subscriber`), running the same Umbraco web project.
- YARP routes the CM hostname to CM over HTTPS and the CD hostname to the two CDs over HTTP.
- One persistent SQL Server content database. The cache object is a **logical `dbo.DistributedCache` table in that same database**, not an extra database server.
- Shared filesystem media and shared local data-protection/imaging keys. No credentials or key values are included.
- Aspire AppHost orchestration and dashboard telemetry, Mailpit, DbGate, and local Umbraco Developer MCP tooling.
- The Astro/Starlight frontend serves local content files independently. It has no invented Umbraco API dependency or YARP route.

Single mode, Redis, and Blob/Azurite are alternatives supported by the repository/template; they are not added as simultaneous resources in this Cluster snapshot. To model another variant, open the preset and adapt the JSON.

The browser/client nodes, dashboard, cache table, and shared directories are explanatory logical objects; they are not all separate deployed containers. Connections labeled **Orchestrates** describe AppHost management/dependency relationships, not application request traffic. There is no direct CM-to-CD HTTP replication arrow because the inspected source does not establish one.

Source files used:

- [Demo README](https://github.com/hallojoe/umbraco-topology/blob/3ce66024ac9e5dc603d42185001656c092a5b425/demo/Example.UmbracoSite/README.md)
- [AppHost.cs](https://github.com/hallojoe/umbraco-topology/blob/3ce66024ac9e5dc603d42185001656c092a5b425/demo/Example.UmbracoSite/Example.UmbracoSite.AppHost/AppHost.cs)
- [Web Program.cs](https://github.com/hallojoe/umbraco-topology/blob/3ce66024ac9e5dc603d42185001656c092a5b425/demo/Example.UmbracoSite/Example.UmbracoSite.Web/Program.cs)
- [YARP Program.cs](https://github.com/hallojoe/umbraco-topology/blob/3ce66024ac9e5dc603d42185001656c092a5b425/demo/Example.UmbracoSite/Example.UmbracoSite.Yarp/Program.cs)

This is a static visualization. Dimentionalizer does not start the Umbraco stack, poll it, or automatically update the snapshot.

## Add a preset

1. Add a version 1 document at `frontend/public/presets/<id>.json`, using a lowercase hyphenated ID.
2. Add its metadata to `frontend/public/presets/index.json`: ID, name, category, summary, and group/object/connection counts. For repository-derived setups, add a source label, pinned URL, and revision.
3. The picker consumes this index; no UI or renderer changes are needed. It fetches only the chosen document, validates it, and opens an independent editable draft.
4. Run `npm test` and `npm run build` in `frontend/`. Update the catalog-count test when intentionally expanding the collection. Tests enforce matching files, counts, valid references, known types, and round-trip export.

Preset URLs honor Vite's configured base path. Failed loads and invalid documents leave the active architecture untouched; closing the picker cancels a pending request.

The four detailed workflow walkthroughs use spacing inheritance and positive/negative elevations. Key objects have editable checklist prompts in the inspector. See [spacing and planning](spacing.md) for how to adapt them.
