/**
 * Loads illustrative data matching the proposal mock-ups, plus one demo user per role.
 * Refuses to run against a database that already has opportunities unless --reset is passed.
 *
 *   npm run db:seed -- --reset
 */
import "./env";
import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth";
import { db, nextRef } from "@/lib/db/collections";
import { mongoClient } from "@/lib/db/mongo";
import type { ActivityDoc, ClientDoc, Milestone, OpportunityDoc, ProjectDoc, Quote, Subject, TaskDoc } from "@/lib/db/types";
import { SOURCE_LABELS, type Role, type Segment, type Source, type Stage } from "@/lib/domain/constants";
import { addDays, today as todayFn } from "@/lib/domain/dates";
import { planMilestones } from "@/lib/domain/billing";
import { quoteFollowUpTasks } from "@/lib/domain/followups";
import { buildProgramme } from "@/lib/domain/programme";
import { setup } from "./setup-db";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "dk-demo-password";

const USERS: { name: string; email: string; role: Role }[] = [
  { name: "Managing Director", email: "md@demo.dklift.test", role: "md" },
  { name: "Sales Admin", email: "sales@demo.dklift.test", role: "sales_admin" },
  { name: "Project Manager", email: "pm@demo.dklift.test", role: "project_manager" },
  { name: "Accounts", email: "accounts@demo.dklift.test", role: "accounts" },
  { name: "Maintenance Manager", email: "maintenance@demo.dklift.test", role: "maintenance_manager" },
];

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset) {
    for (const name of ["clients", "opportunities", "tasks", "activities", "projects", "documents", "counters"]) {
      await mongoClient.db(process.env.MONGODB_DB || undefined).collection(name).deleteMany({});
    }
  } else if (await db.opportunities().estimatedDocumentCount()) {
    throw new Error("Database already has data. Re-run with --reset to replace it with demo data.");
  }
  await setup();

  const ctx = await auth.$context;
  const users: Record<Role, { id: string; name: string }> = {} as never;
  for (const u of USERS) {
    let user = await ctx.internalAdapter.findUserByEmail(u.email).then((r) => r?.user);
    if (!user) {
      user = await ctx.internalAdapter.createUser({ email: u.email, name: u.name, emailVerified: true, role: u.role, active: true }, { method: "admin" });
      await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(DEMO_PASSWORD) });
    }
    users[u.role] = { id: user.id, name: u.name };
  }
  const md = users.md;
  const pm = users.project_manager;
  const products = await db.products().find({}).toArray();
  const product = (name: string) => products.find((p) => p.name === name)!;

  const today = todayFn();
  const now = new Date();
  const ago = (days: number) => addDays(today, -days);
  const at = (d: Date) => new Date(d.getTime() + 10 * 3600_000);
  const audit = (created: Date) => ({ createdAt: created, updatedAt: created, createdBy: md.id });
  const activities: ActivityDoc[] = [];
  const tasks: TaskDoc[] = [];
  const act = (subject: Subject, clientId: ObjectId, type: string, summary: string, when: Date, actor = md) =>
    activities.push({ _id: new ObjectId(), subject, clientId, type, summary, actorId: actor.id, actorName: actor.name, at: when });
  const task = (subject: Subject, title: string, kind: TaskDoc["kind"], dueOn: Date, owner = md, extra: Partial<TaskDoc> = {}) =>
    tasks.push({ _id: new ObjectId(), title, kind, subject, ownerId: owner.id, ownerName: owner.name, dueOn, status: "open", ...audit(now), ...extra });

  // ---------- Clients ----------
  const clients: ClientDoc[] = [];
  const client = (name: string, segment: Segment, clientType: string, contacts: [string, string?, string?][], sites: [string, string?, number?, number?][]) => {
    const c: ClientDoc = {
      _id: new ObjectId(),
      name,
      nameLower: name.toLowerCase(),
      segment,
      clientType,
      accountOwnerId: md.id,
      contacts: contacts.map(([n, role, email]) => ({ _id: new ObjectId(), name: n, role, email })),
      sites: sites.map(([n, postcode, lifts = 0, maint = 0]) => ({
        _id: new ObjectId(),
        name: n,
        postcode,
        lifts: Array.from({ length: lifts }, (_, i) => ({
          _id: new ObjectId(),
          productName: i % 2 ? "Stairlift (straight)" : "Platform lift",
          servicedBy: "dk" as const,
          onMaintenance: i < maint,
        })),
      })),
      ...audit(ago(400)),
    };
    clients.push(c);
    return c;
  };

  const medway = client("Medway Housing Trust", "end_user_contractor", "Housing association", [["Asset Manager", "Decision maker · capital works budget", "assets@medwayht.example"], ["Procurement Officer", "Framework and purchase orders"], ["Site Caretaker", "Access and site visits"]], [["Chatham Court, Gillingham", "ME7 1AA"], ["Rochester Gardens", "ME1 2BB", 1, 1], ["Strood Community Hub", "ME2 3CC", 1, 1], ["Luton Road Flats", "ME4 5DD", 3, 0]]);
  const aldric = client("St Aldric's Primary School", "end_user_contractor", "School", [["School Business Manager", "Decision maker", "sbm@staldrics.example"]], [["Main hall stage, Bexley", "DA5 1AA"]]);
  const harrow = client("Harrow Lane Surgery", "end_user_contractor", "GP surgery", [["Practice Manager", "Decision maker", "pm@harrowlane.example"]], [["Reception, Harrow Lane", "DA1 4AB"]]);
  const granary = client("The Old Granary", "domestic", "Private residence", [["Mrs Ellis", "Homeowner"]], [["The Old Granary, Sevenoaks", "TN13 1AA"]]);
  const riverside = client("Riverside Dental", "end_user_contractor", "Dental practice", [["Practice Owner", "Decision maker"]], [["Riverside Dental, Dartford", "DA1 1RD"]]);
  const ashby = client("Ashby Main Contractors", "end_user_contractor", "Main contractor", [["Project Surveyor", "Commercial"]], [["Northfleet Academy", "DA11 8BB"]]);
  const hollins = client("Hollins and Co Solicitors", "end_user_contractor", "Professional services", [["Office Manager", "Decision maker"]], [["Hollins House, Gravesend", "DA12 1HH"]]);
  const greenway = client("Greenway Leisure", "end_user_contractor", "Leisure operator", [["Facilities Manager", "Decision maker"]], [["Greenway Leisure Centre", "DA2 6GL"]]);
  const harlow = client("Mr D. Harlow", "domestic", "Private residence", [["Mr D. Harlow", "Homeowner"]], [["Harlow residence, Wilmington", "DA2 7HR"]]);
  const kestrel = client("Kestrel Build Ltd", "end_user_contractor", "Main contractor", [["Estimator", "Tenders"]], [["Kestrel distribution unit", "ME20 7KB"]]);
  const okafor = client("Mr and Mrs Okafor", "domestic", "Private residence", [["Mrs Okafor", "Homeowner"]], [["Okafor residence, Bexleyheath", "DA7 4OK"]]);
  const walsh = client("Mrs P. Walsh", "domestic", "Private residence", [["Mrs P. Walsh", "Homeowner"]], [["Walsh residence, Crayford", "DA1 4PW"]]);
  const hartley = client("Hartley Care Homes", "end_user_contractor", "Care home group", [["Operations Director", "Decision maker"]], [["Hartley House", "DA3 8HC"]]);
  const bexley = client("Bexley Road Medical Centre", "end_user_contractor", "GP surgery", [["Practice Manager", "Decision maker"]], [["Bexley Road Medical Centre", "DA8 3BR"]]);
  const swanley = client("Swanley Court Apartments", "end_user_contractor", "Residential block", [["Managing Agent", "Decision maker"]], [["Swanley Court", "BR8 7SC"]]);
  const liftco = client("Southern Access Lifts", "lift_company", "Lift company", [["Contracts Manager", "Subcontract orders", "contracts@southernaccess.example"]], [["Ashford retail unit", "TN23 1SA"]]);
  await db.clients().insertMany(clients);

  // ---------- Opportunities ----------
  type Spec = {
    c: ClientDoc;
    product: string;
    qty?: number;
    source: Source;
    stage: Stage;
    low: number;
    high?: number;
    created: number;
    quote?: { total: number; sent: number };
    lost?: string;
    closed?: number;
    owner?: { id: string; name: string };
    survey?: number;
    triage?: boolean;
  };
  const specs: Spec[] = [
    { c: harrow, product: "Step lift", source: "google_ads", stage: "enquiry", low: 14_800, created: 2, triage: true },
    { c: okafor, product: "Through-floor home lift", source: "website", stage: "enquiry", low: 26_000, high: 29_000, created: 1 },
    { c: kestrel, product: "Goods lift", source: "email", stage: "enquiry", low: 46_000, created: 2 },
    { c: granary, product: "Dumbwaiter", source: "repeat_referral", stage: "survey_booked", low: 9_600, created: 6, survey: 3 },
    { c: medway, product: "Platform lift", qty: 2, source: "trade", stage: "survey_booked", low: 71_200, created: 8, survey: 2 },
    { c: riverside, product: "Inclined platform lift", source: "website", stage: "quote_sent", low: 22_350, created: 12, quote: { total: 22_350, sent: 2 } },
    { c: ashby, product: "Platform lift", source: "trade", stage: "quote_sent", low: 41_900, created: 14, quote: { total: 41_900, sent: 3 } },
    { c: walsh, product: "Stairlift (curved)", source: "phone", stage: "quote_sent", low: 7_450, created: 5, quote: { total: 7_450, sent: 1 } },
    { c: aldric, product: "Platform lift", source: "google_ads", stage: "follow_up", low: 35_000, high: 40_000, created: 31, quote: { total: 38_450, sent: 10 } },
    { c: hollins, product: "Platform lift", source: "website", stage: "follow_up", low: 29_900, created: 20, quote: { total: 29_900, sent: 11 } },
    { c: liftco, product: "Platform lift (external)", source: "trade", stage: "follow_up", low: 31_500, created: 26, quote: { total: 31_500, sent: 16 }, survey: -20 },
    { c: greenway, product: "Platform lift", source: "trade", stage: "won", low: 33_700, created: 120, quote: { total: 33_700, sent: 100 }, closed: 95 },
    { c: hartley, product: "Through-floor home lift", qty: 2, source: "repeat_referral", stage: "won", low: 33_700, created: 150, quote: { total: 33_700, sent: 130 }, closed: 110 },
    { c: harlow, product: "Cabin home lift", source: "website", stage: "won", low: 31_200, created: 60, quote: { total: 31_200, sent: 40 }, closed: 12 },
    { c: bexley, product: "Platform lift", source: "google_ads", stage: "won", low: 28_900, created: 170, quote: { total: 28_900, sent: 150 }, closed: 140 },
    { c: ashby, product: "Platform lift", source: "trade", stage: "won", low: 41_250, created: 90, quote: { total: 41_250, sent: 70 }, closed: 30 },
    { c: swanley, product: "Platform lift", source: "phone", stage: "won", low: 46_100, created: 200, quote: { total: 46_100, sent: 180 }, closed: 170 },
    { c: medway, product: "Platform lift", source: "trade", stage: "won", low: 31_600, created: 260, quote: { total: 31_600, sent: 230 }, closed: 200 },
    { c: medway, product: "Through-floor home lift", source: "trade", stage: "lost", low: 24_300, created: 240, quote: { total: 24_300, sent: 225 }, closed: 210, lost: "Price" },
    { c: okafor, product: "Stairlift (straight)", source: "google_ads", stage: "lost", low: 3_900, created: 80, quote: { total: 3_900, sent: 70 }, closed: 50, lost: "Lost to competitor" },
    { c: hollins, product: "Step lift", source: "website", stage: "lost", low: 12_400, created: 70, quote: { total: 12_400, sent: 60 }, closed: 20, lost: "No budget" },
  ];

  const opportunities: OpportunityDoc[] = [];
  for (const s of specs) {
    const p = product(s.product);
    const ref = await nextRef("opportunity");
    const created = at(ago(s.created));
    const owner = s.owner ?? md;
    const quotes: Quote[] = [];
    if (s.quote) {
      quotes.push({
        _id: new ObjectId(),
        ref: await nextRef("quote"),
        revision: 1,
        totalPence: s.quote.total * 100,
        options: s.product.startsWith("Platform") ? [{ label: "Automatic doors", pence: 320_000 }] : [],
        status: s.stage === "won" ? "accepted" : s.stage === "lost" ? "declined" : "sent",
        sentOn: ago(s.quote.sent),
        createdAt: at(ago(s.quote.sent)),
      });
    }
    const o: OpportunityDoc = {
      _id: new ObjectId(),
      ref,
      clientId: s.c._id,
      clientName: s.c.name,
      contactId: s.c.contacts[0]._id,
      contactName: s.c.contacts[0].name,
      siteId: s.c.sites[0]._id,
      siteName: s.c.sites[0].name,
      segment: s.c.segment,
      productId: p._id,
      productName: p.name,
      quantity: s.qty ?? 1,
      source: s.source,
      valueLowPence: s.low * 100,
      valueHighPence: (s.high ?? s.low) * 100,
      valuePence: (s.quote?.total ?? (s.high ? (s.low + s.high) / 2 : s.low)) * 100,
      ownerId: owner.id,
      ownerName: owner.name,
      stage: s.stage,
      stageChangedAt: s.closed ? at(ago(s.closed)) : s.quote ? at(ago(s.quote.sent)) : created,
      quotes,
      quoteSentOn: s.quote ? ago(s.quote.sent) : undefined,
      closedAt: s.closed ? at(ago(s.closed)) : undefined,
      lostReason: s.lost,
      needsTriage: s.triage,
      description:
        s.c === aldric
          ? "Hall stage to main floor, approx. 1.1m rise. Decision by governors; install preferred over February half term."
          : undefined,
      installWindow: s.c === aldric ? "February half term" : undefined,
      survey:
        s.survey !== undefined
          ? {
              scheduledAt: at(addDays(today, s.survey)),
              surveyorId: pm.id,
              surveyorName: pm.name,
              attendees: "Project manager, client contact",
              feePence: s.c.segment === "lift_company" ? 35_000 : 0,
              feeStatus: s.c.segment === "lift_company" ? "invoiced" : "none",
              completedAt: s.survey < 0 ? at(addDays(today, s.survey)) : undefined,
            }
          : undefined,
      ...audit(created),
    };
    opportunities.push(o);
    const subject: Subject = { type: "opportunity", id: o._id, ref, label: o.clientName };
    act(subject, o.clientId, "opportunity.created", `Enquiry ${ref} logged from ${SOURCE_LABELS[s.source]}`, created, s.triage ? users.sales_admin : md);

    if (s.stage === "enquiry") {
      task(subject, s.triage ? "Triage web enquiry: confirm details and set next action" : "Send brochure and book survey", "call", s.triage ? today : addDays(today, 1), s.triage ? users.sales_admin : md);
    }
    if (o.survey && o.survey.scheduledAt! > now) {
      task(subject, `Survey · ${o.siteName}`, "survey", addDays(today, s.survey!), pm);
      act(subject, o.clientId, "survey.booked", `Survey booked with ${pm.name}`, at(ago(1)));
    }
    if (s.quote) {
      act(subject, o.clientId, "quote.sent", `Quote ${quotes[0].ref} issued at £${s.quote.total.toLocaleString("en-GB")}`, at(ago(s.quote.sent)));
      if (s.stage === "quote_sent" || s.stage === "follow_up") {
        for (const t of quoteFollowUpTasks(quotes[0].ref, ago(s.quote.sent))) {
          const isPast = t.dueOn < today;
          // Most past follow-ups were done on time; one is left overdue to show the escalation.
          const leaveOverdue = s.c === hollins && t.ruleKey.includes("d10");
          task(subject, t.title, t.kind, t.dueOn, owner, {
            ruleKey: t.ruleKey,
            ...(isPast && !leaveOverdue ? { status: "done", completedAt: at(t.dueOn), completedBy: owner.id, onTime: true } : {}),
          });
        }
      }
    }
    if (s.closed) {
      act(subject, o.clientId, s.stage === "won" ? "opportunity.won" : "opportunity.lost", s.stage === "won" ? "Won" : `Lost: ${s.lost}`, at(ago(s.closed)));
    }
  }
  await db.opportunities().insertMany(opportunities);

  // ---------- Projects ----------
  const projects: ProjectDoc[] = [];
  const projectPlan: { client: ClientDoc; poDaysAgo: number | null; done: string[]; paid: number; handover?: boolean }[] = [
    { client: greenway, poDaysAgo: 70, done: ["client_po", "manufacturer_po", "drawings", "drawings_signoff"], paid: 1 },
    { client: hartley, poDaysAgo: 85, done: ["client_po", "manufacturer_po", "drawings", "drawings_signoff", "manufacture"], paid: 2 },
    { client: harlow, poDaysAgo: 8, done: ["client_po", "manufacturer_po"], paid: 1 },
    { client: bexley, poDaysAgo: 98, done: ["client_po", "manufacturer_po", "drawings", "drawings_signoff", "manufacture", "release", "labour_rams", "collection"], paid: 2 },
    { client: ashby, poDaysAgo: null, done: [], paid: 0 },
    { client: swanley, poDaysAgo: 150, done: ["client_po", "manufacturer_po", "drawings", "drawings_signoff", "manufacture", "release", "labour_rams", "collection", "install", "handover"], paid: 3, handover: true },
  ];
  for (const plan of projectPlan) {
    const o = opportunities.find((x) => x.clientId.equals(plan.client._id) && x.stage === "won")!;
    const p = product(o.productName);
    const ref = await nextRef("project");
    const contract = o.valuePence;
    const programme = plan.poDaysAgo === null ? [] : buildProgramme({ clientPoOn: ago(plan.poDaysAgo), leadTimeWeeks: p.leadTimeWeeks, installDays: p.installDays }).map((i) => (plan.done.includes(i.key) ? { ...i, done: true, completedOn: i.end } : i));
    const milestones: Milestone[] = programme.length
      ? planMilestones(contract, programme).map((m, idx) => ({
          _id: new ObjectId(),
          ...m,
          status: idx < plan.paid ? "paid" : idx === plan.paid && m.dueOn && m.dueOn <= addDays(today, 30) ? "raised" : "scheduled",
          paidOn: idx < plan.paid ? m.dueOn ?? undefined : undefined,
          raisedOn: idx <= plan.paid && m.dueOn ? m.dueOn : undefined,
          invoiceRef: idx <= plan.paid ? `INV-${2260 + projects.length * 3 + idx}` : undefined,
        }))
      : [];
    const handoverOn = plan.handover ? programme.find((i) => i.key === "handover")!.end : undefined;
    const project: ProjectDoc = {
      _id: new ObjectId(),
      ref,
      opportunityId: o._id,
      opportunityRef: o.ref,
      clientId: o.clientId,
      clientName: o.clientName,
      siteId: o.siteId,
      siteName: o.siteName,
      productName: o.productName,
      quantity: o.quantity,
      pmId: pm.id,
      pmName: pm.name,
      contractValuePence: contract,
      surveyCreditPence: 0,
      clientPoOn: plan.poDaysAgo === null ? undefined : ago(plan.poDaysAgo),
      clientPoRef: plan.poDaysAgo === null ? undefined : `PO-${4400 + projects.length}`,
      manufacturer: "Manufacturer to confirm",
      leadTimeWeeks: p.leadTimeWeeks,
      installDays: p.installDays,
      status: plan.poDaysAgo === null ? "awaiting_po" : plan.handover ? "complete" : "live",
      programme,
      milestones,
      handoverOn,
      warrantyEndsOn: handoverOn ? addDays(handoverOn, 365) : undefined,
      ...audit(o.closedAt!),
    };
    projects.push(project);
    await db.opportunities().updateOne({ _id: o._id }, { $set: { projectId: project._id } });
    const subject: Subject = { type: "project", id: project._id, ref, label: project.clientName };
    act(subject, project.clientId, "project.created", `Project created from ${o.ref}, PM ${pm.name}`, o.closedAt!);
    if (plan.poDaysAgo === null) task(subject, "Record client PO and raise 60% deposit", "doc", addDays(today, 1), pm, { ruleKey: `project.po:${ref}` });
    const nextItem = programme.find((i) => !i.done && !i.key.startsWith("service_"));
    if (nextItem) task(subject, nextItem.label, "general", nextItem.end < today ? today : nextItem.end, pm);
  }
  await db.projects().insertMany(projects);
  await db.tasks().insertMany(tasks);
  await db.activities().insertMany(activities);

  console.log(`Demo data loaded: ${clients.length} clients, ${opportunities.length} opportunities, ${projects.length} projects, ${tasks.length} tasks.`);
  console.log(`Demo users (password "${DEMO_PASSWORD}"): ${USERS.map((u) => u.email).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoClient.close());
