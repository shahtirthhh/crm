import type { ObjectId } from "mongodb";

import type {
  MilestoneKind,
  MilestoneStatus,
  ProjectStatus,
  Role,
  Segment,
  Source,
  Stage,
  TaskKind,
} from "@/lib/domain/constants";
import type { ProgrammeItem } from "@/lib/domain/programme";

// Money is integer pence. "Day" fields are UTC-midnight Dates (see lib/domain/dates).

export interface Audit {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/** Better Auth's user collection, with the CRM's additional fields. */
export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDoc extends Audit {
  _id: ObjectId;
  name: string;
  category: string;
  manufacturer?: string;
  leadTimeWeeks: number;
  installDays: number;
  active: boolean;
}

export interface Lift {
  _id: ObjectId;
  productName: string;
  servicedBy: "dk" | "other";
  onMaintenance: boolean;
  projectId?: ObjectId;
  handoverOn?: Date;
  warrantyEndsOn?: Date;
  notes?: string;
}

export interface Site {
  _id: ObjectId;
  name: string;
  address?: string;
  postcode?: string;
  notes?: string;
  lifts: Lift[];
}

export interface Contact {
  _id: ObjectId;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

/** Contacts and sites are embedded: they are small, bounded and always read with the client. */
export interface ClientDoc extends Audit {
  _id: ObjectId;
  name: string;
  nameLower: string;
  segment: Segment;
  clientType?: string;
  accountOwnerId?: string;
  notes?: string;
  contacts: Contact[];
  sites: Site[];
}

export interface Survey {
  scheduledAt?: Date;
  attendees?: string;
  surveyorId?: string;
  surveyorName?: string;
  completedAt?: Date;
  measurements?: string;
  civilWorks?: string;
  feePence: number;
  feeStatus: "none" | "invoiced" | "paid" | "credited";
}

export interface QuoteOption {
  label: string;
  pence: number;
}

export interface Quote {
  _id: ObjectId;
  ref: string;
  revision: number;
  totalPence: number;
  options: QuoteOption[];
  documentId?: ObjectId;
  status: "draft" | "sent" | "superseded" | "accepted" | "declined";
  sentOn?: Date;
  notes?: string;
  createdAt: Date;
}

/**
 * Client, contact, site, product and owner names are copied onto the opportunity so the
 * board, lists and reports never need a join. Renames are propagated by the DAL.
 */
export interface OpportunityDoc extends Audit {
  _id: ObjectId;
  ref: string;
  clientId: ObjectId;
  clientName: string;
  contactId?: ObjectId;
  contactName?: string;
  siteId?: ObjectId;
  siteName?: string;
  segment: Segment;
  productId?: ObjectId;
  productName: string;
  quantity: number;
  source: Source;
  campaign?: string;
  tracking?: { gclid?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };
  valueLowPence?: number;
  valueHighPence?: number;
  /** Denormalised: current quote total, else midpoint of the estimate. */
  valuePence: number;
  ownerId: string;
  ownerName: string;
  stage: Stage;
  stageChangedAt: Date;
  description?: string;
  decisionOn?: Date;
  installWindow?: string;
  survey?: Survey;
  quotes: Quote[];
  /** sentOn of the current quote, kept top-level for indexing. */
  quoteSentOn?: Date;
  lostReason?: string;
  lostTo?: string;
  closedAt?: Date;
  projectId?: ObjectId;
  needsTriage?: boolean;
}

export type SubjectType = "opportunity" | "project" | "client";

export interface Subject {
  type: SubjectType;
  id: ObjectId;
  ref: string;
  label: string;
}

export interface TaskDoc extends Audit {
  _id: ObjectId;
  title: string;
  kind: TaskKind;
  subject: Subject;
  ownerId: string;
  ownerName: string;
  dueOn: Date;
  status: "open" | "done" | "cancelled";
  completedAt?: Date;
  completedBy?: string;
  /** Completed on or before its due day; drives the follow-up discipline measure. */
  onTime?: boolean;
  outcome?: string;
  notes?: string;
  ruleKey?: string;
}

export interface ActivityDoc {
  _id: ObjectId;
  subject: Subject;
  clientId?: ObjectId;
  type: string;
  summary: string;
  actorId: string;
  actorName: string;
  at: Date;
  meta?: Record<string, unknown>;
}

export interface Milestone {
  _id: ObjectId;
  kind: MilestoneKind;
  label: string;
  percent: number;
  amountPence: number;
  dueOn?: Date | null;
  status: MilestoneStatus;
  invoiceRef?: string;
  raisedOn?: Date;
  paidOn?: Date;
}

export interface ProjectDoc extends Audit {
  _id: ObjectId;
  ref: string;
  opportunityId: ObjectId;
  opportunityRef: string;
  clientId: ObjectId;
  clientName: string;
  siteId?: ObjectId;
  siteName?: string;
  productName: string;
  quantity: number;
  pmId: string;
  pmName: string;
  contractValuePence: number;
  surveyCreditPence: number;
  clientPoRef?: string;
  clientPoOn?: Date;
  manufacturer?: string;
  manufacturerPoRef?: string;
  leadTimeWeeks: number;
  installDays: number;
  status: ProjectStatus;
  /** Embedded: bounded, edited and displayed together. */
  programme: ProgrammeItem[];
  milestones: Milestone[];
  handoverOn?: Date;
  warrantyEndsOn?: Date;
  notes?: string;
}

export interface DocumentDoc {
  _id: ObjectId;
  subject: Subject;
  category: "quote" | "drawing" | "photo" | "rams" | "contract" | "other";
  name: string;
  pathname: string;
  contentType?: string;
  size?: number;
  revision?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;
}

export interface SettingsDoc {
  _id: "settings";
  stageProbability: Record<string, number>;
  triageOwnerId?: string;
  setupVersion?: number;
  updatedAt: Date;
}
