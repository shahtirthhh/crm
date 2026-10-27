import { z } from "zod";

import {
  LOST_REASONS,
  MILESTONE_STATUSES,
  OPEN_STAGES,
  ROLES,
  SEGMENTS,
  SOURCES,
  TASK_KINDS,
} from "@/lib/domain/constants";
import { parseDay } from "@/lib/domain/dates";
import { parseMoney } from "@/lib/domain/money";
import { PROGRAMME_KEYS } from "@/lib/domain/programme";

// Shared by forms and Server Actions. Blank form fields arrive as "" and become undefined.

const text = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const requiredText = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

const objectId = (label: string) =>
  z.string({ error: `${label} is required` }).regex(/^[a-f0-9]{24}$/i, `${label} is required`);

const optionalObjectId = z
  .string()
  .optional()
  .transform((v) => (v && /^[a-f0-9]{24}$/i.test(v) ? v : undefined));

const money = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      try {
        return parseMoney(v);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} must be an amount in pounds` });
        return z.NEVER;
      }
    });

const requiredMoney = (label: string) =>
  money(label).refine((v) => v !== undefined && v > 0, `${label} is required`);

const day = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      try {
        return parseDay(v);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} must be a date` });
        return z.NEVER;
      }
    });

const requiredDay = (label: string) => day(label).refine((v) => v !== undefined, `${label} is required`);

export const clientSchema = z.object({
  name: requiredText("Client name"),
  segment: z.enum(SEGMENTS, { error: "Segment is required" }),
  clientType: text(),
  accountOwnerId: optionalObjectId,
  notes: text(4000),
});

export const contactSchema = z.object({
  name: requiredText("Contact name"),
  role: text(),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("Enter a valid email").optional()),
  phone: text(40),
});

export const siteSchema = z.object({
  name: requiredText("Site name"),
  address: text(400),
  postcode: text(12),
  notes: text(2000),
});

export const opportunitySchema = z
  .object({
    clientId: optionalObjectId,
    newClientName: text(),
    contactId: optionalObjectId,
    newContactName: text(),
    newContactPhone: text(40),
    newContactEmail: text(),
    siteId: optionalObjectId,
    newSiteName: text(),
    segment: z.enum(SEGMENTS, { error: "Segment is required" }),
    productId: objectId("Product"),
    quantity: z.coerce.number().int().min(1).max(50).default(1),
    source: z.enum(SOURCES, { error: "Source is required" }),
    campaign: text(),
    valueLow: money("Estimated value"),
    valueHigh: money("Estimated value"),
    ownerId: objectId("Owner"),
    description: text(4000),
    nextActionTitle: requiredText("Next action"),
    nextActionDue: requiredDay("Next action date"),
    installWindow: text(),
  })
  // `when` runs these even if other fields failed, so every missing field is reported at once.
  .refine((v) => v.clientId || v.newClientName, { message: "Client is required", path: ["clientId"], when: () => true })
  .refine((v) => v.contactId || v.newContactName, { message: "Contact is required", path: ["contactId"], when: () => true })
  .refine((v) => !(v.valueLow && v.valueHigh && v.valueLow > v.valueHigh), {
    message: "The low estimate is above the high estimate",
    path: ["valueHigh"],
  });

export const opportunityUpdateSchema = z.object({
  productId: objectId("Product"),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  source: z.enum(SOURCES),
  campaign: text(),
  valueLow: money("Estimated value"),
  valueHigh: money("Estimated value"),
  ownerId: objectId("Owner"),
  description: text(4000),
  installWindow: text(),
  decisionOn: day("Decision date"),
  siteId: optionalObjectId,
  contactId: optionalObjectId,
});

export const stageSchema = z.object({ stage: z.enum(OPEN_STAGES) });

export const surveySchema = z.object({
  scheduledAt: z
    .string()
    .min(1, "Survey date is required")
    .transform((v, ctx) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Survey date is invalid" });
        return z.NEVER;
      }
      return d;
    }),
  surveyorId: objectId("Surveyor"),
  attendees: text(400),
  fee: money("Survey fee"),
});

export const surveyResultSchema = z.object({
  measurements: text(4000),
  civilWorks: text(4000),
  feeStatus: z.enum(["none", "invoiced", "paid", "credited"]).default("none"),
});

export const quoteSchema = z.object({
  total: requiredMoney("Quote total"),
  options: z
    .string()
    .optional()
    .transform((v, ctx) => {
      // One option per line: "Automatic doors | 3200"
      const lines = (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      const out: { label: string; pence: number }[] = [];
      for (const line of lines) {
        const [label, amount] = line.split("|").map((s) => s.trim());
        try {
          const pence = parseMoney(amount);
          if (!label || pence === undefined) throw new Error();
          out.push({ label, pence });
        } catch {
          ctx.addIssue({ code: "custom", message: `Option "${line}" should look like "Automatic doors | 3200"` });
          return z.NEVER;
        }
      }
      return out;
    }),
  notes: text(2000),
  sendNow: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  sentOn: day("Sent date"),
});

export const wonSchema = z.object({
  contractValue: requiredMoney("Contract value"),
  pmId: objectId("Project manager"),
});

export const lostSchema = z.object({
  lostReason: z.enum(LOST_REASONS, { error: "Choose a reason" }),
  lostTo: text(),
  notes: text(2000),
});

export const taskSchema = z.object({
  title: requiredText("Task"),
  kind: z.enum(TASK_KINDS).default("general"),
  ownerId: objectId("Owner"),
  dueOn: requiredDay("Due date"),
  notes: text(2000),
});

export const completeTaskSchema = z.object({ outcome: text(2000) });

export const noteSchema = z.object({ note: requiredText("Note", 4000) });

export const clientPoSchema = z.object({
  clientPoRef: text(),
  clientPoOn: requiredDay("Client PO date"),
  manufacturer: text(),
  leadTimeWeeks: z.coerce.number().int().min(1).max(52),
  installDays: z.coerce.number().int().min(1).max(30),
});

export const projectDetailsSchema = z.object({
  pmId: objectId("Project manager"),
  manufacturer: text(),
  manufacturerPoRef: text(),
  clientPoRef: text(),
  notes: text(4000),
});

export const programmeItemSchema = z.object({
  key: z.enum(PROGRAMME_KEYS),
  start: requiredDay("Start"),
  end: requiredDay("End"),
  cascade: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const milestoneSchema = z.object({
  status: z.enum(MILESTONE_STATUSES),
  invoiceRef: text(40),
  on: day("Date"),
});

export const handoverSchema = z.object({
  handoverOn: requiredDay("Handover date"),
  onMaintenance: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const productSchema = z.object({
  name: requiredText("Product name"),
  category: requiredText("Category"),
  manufacturer: text(),
  leadTimeWeeks: z.coerce.number().int().min(1).max(52),
  installDays: z.coerce.number().int().min(1).max(30),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const userSchema = z.object({
  name: requiredText("Name"),
  email: z.email("Enter a valid email").transform((v) => v.toLowerCase()),
  role: z.enum(ROLES),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

export const userUpdateSchema = z.object({
  role: z.enum(ROLES),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

/** Public website form. Field names match a plain HTML form on dkliftservices.co.uk. */
export const webEnquirySchema = z.object({
  name: requiredText("Name"),
  organisation: text(),
  email: z.email("Enter a valid email").optional().or(z.literal("").transform(() => undefined)),
  phone: text(40),
  postcode: text(12),
  product: text(),
  message: text(4000),
  segment: z.enum(SEGMENTS).optional().catch(undefined),
  gclid: text(),
  utm_source: text(),
  utm_medium: text(),
  utm_campaign: text(),
  website: z.string().optional(), // honeypot: must be empty
});

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
