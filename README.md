# D.K Projects CRM

The system of record for D.K Lift Services' projects business. It covers every enquiry from first contact to handover, along with quote follow-ups, live project programmes and 60 / 20 / 20 stage billing. See [`docs/PLAN.md`](docs/PLAN.md) for the plan, and the proposal it implements.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · MongoDB (official driver) · Better Auth · Zod · Vercel Blob · Vercel Cron.

## Modules

| Module | Where | What it does |
|---|---|---|
| 01 Opportunities and clients | `/opportunities/new`, `/clients` | One form for every source (under 2 minutes, works on a phone). Clients hold their contacts, sites and installed lifts, plus the full history. |
| 02 Pipeline and reporting | `/pipeline`, `/dashboard`, `/pipeline/monday` | Drag-and-drop stage board, list, won/lost, sales dashboard and the Monday review. |
| 03 Quotes and follow-up | `/surveys`, `/quotes`, `/follow-ups` | Survey records with the £350 trade fee. Quote register with revisions. Marking a quote sent creates day 4 and day 10 tasks. Quotes with no decision after 14 days are escalated. Follow-up discipline is measured. |
| 04 Live projects | `/projects` | Won opportunities become projects. Recording the client PO generates the programme from a template, shown as a Gantt that can be rescheduled with cascade. The release-at-risk guard warns before a lift is released unpaid. Handover records the lift on the client's site and schedules the warranty services. |
| 05 Billing milestones | `/billing` | The 60 / 20 / 20 schedule. Due dates are derived from the programme. Accounts set raised/paid. Overdue payments get chase tasks automatically. |
| Website intake | `POST /api/enquiries` | Public endpoint for the website form, with gclid/UTM capture, honeypot and rate limit. Enquiries land in the triage queue. |
| Today (mobile) | `/` | My tasks (overdue first), the headline pipeline, and site visits and installs this week. |

## Architecture

```
app/(app)/…            pages (Server Components, each behind a loading.tsx Suspense boundary)
app/api/…              auth, public enquiry form, cron, document upload/download
components/ui/         shadcn/ui primitives (new-york, Tailwind v4)
components/app/        CRM components (forms, board, Gantt, task list…)
lib/domain/            pure business rules: stages, follow-ups, programme template, billing, permissions (unit tested)
lib/dal/               data access layer: the only code that touches MongoDB; every read/write is authorised here
lib/actions/           Server Actions: parse with Zod → authorise → DAL → refresh()/updateTag()
lib/db/                Mongo client (pooled, Vercel Fluid-aware), typed collections, indexes, reference counters
scripts/               db:setup (indexes, products, first admin) and db:seed (demo data)
proxy.ts               optimistic redirect to /login (real checks live in lib/dal/session.ts)
```

Design notes:

- **Data model.**
  - Contacts, sites and installed lifts are embedded in the client document.
  - Surveys and quote revisions are embedded in the opportunity.
  - Programme items and billing milestones are embedded in the project.
  - Tasks, activity and documents are separate, indexed collections because they are queried across records.
  - Names are denormalised onto opportunities and projects, so the board and reports need no joins. Renames are propagated in the DAL.
- **Consistency.** Multi-document writes use transactions: marking a quote sent, and marking an opportunity won. These need a replica set, which Atlas always is. References like ENQ-2631, Q-1187 and P-0412 come from atomic counters.
- **Idempotent automation.** Rule-created tasks carry a unique `ruleKey`, so the daily cron and repeated clicks never create duplicates.
- **Caching.**
  - Operational data is always fresh. Pages stream behind Suspense, and Server Actions call `refresh()` after a change.
  - Reference data (users, products, settings) is cached with `'use cache'` + `cacheTag` and invalidated with `updateTag`.
- **Security.**
  - Sign-up is disabled; administrators create users.
  - Deactivated users cannot start sessions and their existing sessions are revoked.
  - Role capabilities live in `lib/domain/permissions.ts` and are enforced in every action.
  - Documents are private blobs, served only through an authenticated route.

## Local development

You need Node 20.9+ and a MongoDB replica set. A single-node replica set in Docker works:

```bash
docker run -d --name crm-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec crm-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'

cp .env.example .env.local
# set MONGODB_URI=mongodb://127.0.0.1:27017/dk_crm?replicaSet=rs0&directConnection=true
# set BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:3000, SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

npm install
npm run db:setup          # indexes, product catalogue, first administrator
npm run db:seed -- --reset  # optional: illustrative demo data + one user per role (password: dk-demo-password)
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Deploying to Vercel

1. **MongoDB Atlas.** Create a cluster in a London region (AWS eu-west-2). Create a database user. Allow access from Vercel: use `0.0.0.0/0` with a strong password, or Atlas' Vercel integration. Copy the connection string.
2. **Vercel project.** Import the repository. The framework is detected as Next.js, and `vercel.json` pins functions to `lhr1` (London) and registers the daily cron.
3. **Storage.** Create a Blob store in the project's Storage tab. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Environment variables.** Set these for Production, plus Preview if you use it:
   - `MONGODB_URI`
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: the production URL
   - `CRON_SECRET`
   - `ENQUIRY_ALLOWED_ORIGINS`: e.g. `https://www.dkliftservices.co.uk`
   - optionally the three `MICROSOFT_*` variables
5. **Initialise the database once**, from your machine, against the production URI:
   ```bash
   MONGODB_URI="mongodb+srv://…" SEED_ADMIN_EMAIL=md@dkliftservices.co.uk SEED_ADMIN_PASSWORD='…' npm run db:setup
   ```
   Re-run it after upgrades that add indexes; it is idempotent. Do not run `db:seed` against production.
6. **Microsoft sign-in (optional).** In Entra ID, register an app with redirect URI `https://<your-domain>/api/auth/callback/microsoft` and set the `MICROSOFT_*` variables. Users must already exist in the CRM with the same email.
7. **Website form.** Point the enquiry form at `https://<your-domain>/api/enquiries`. The accepted fields are listed under Settings in the app.

## Roles

| Role | Can |
|---|---|
| Managing Director, Administrator | Everything, including settings and users |
| Sales administration | Log and edit enquiries, clients, surveys and quotes |
| Project manager | Sales, plus mark won/lost and run projects (PO, programme, handover) |
| Accounts | Set billing status and add chase tasks; view everything |
| Maintenance manager | View; receives handover and warranty-service tasks |
| Engineer | View only |
