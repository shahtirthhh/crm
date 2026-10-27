// Reference data for the D.K Projects CRM. Labels are what users see; keys are stored.

export const ROLES = [
  "admin",
  "md",
  "sales_admin",
  "project_manager",
  "accounts",
  "maintenance_manager",
  "engineer",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  md: "Managing Director",
  sales_admin: "Sales administration",
  project_manager: "Project manager",
  accounts: "Accounts",
  maintenance_manager: "Maintenance manager",
  engineer: "Engineer",
};

export const SEGMENTS = ["domestic", "end_user_contractor", "lift_company"] as const;
export type Segment = (typeof SEGMENTS)[number];
export const SEGMENT_LABELS: Record<Segment, string> = {
  domestic: "Domestic",
  end_user_contractor: "End user / contractor",
  lift_company: "Lift company",
};

export const SOURCES = ["google_ads", "website", "email", "phone", "trade", "repeat_referral"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<Source, string> = {
  google_ads: "Google Ads",
  website: "Website",
  email: "Email",
  phone: "Phone",
  trade: "Trade",
  repeat_referral: "Repeat / referral",
};

export const OPEN_STAGES = ["enquiry", "survey_booked", "quote_sent", "follow_up"] as const;
export const STAGES = [...OPEN_STAGES, "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export type OpenStage = (typeof OPEN_STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  enquiry: "Enquiry",
  survey_booked: "Survey booked",
  quote_sent: "Quote sent",
  follow_up: "Follow-up",
  won: "Won",
  lost: "Lost",
};

/** Default likelihood to close, used for the weighted pipeline. Editable in settings. */
export const DEFAULT_STAGE_PROBABILITY: Record<OpenStage, number> = {
  enquiry: 0.1,
  survey_booked: 0.25,
  quote_sent: 0.4,
  follow_up: 0.5,
};

export const LOST_REASONS = [
  "Price",
  "Lead time",
  "Lost to competitor",
  "Project cancelled",
  "No budget",
  "No response",
  "Specification not suitable",
  "Other",
] as const;

export const TASK_KINDS = ["call", "email", "survey", "doc", "chase", "general"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  call: "Call",
  email: "Email",
  survey: "Survey",
  doc: "Document",
  chase: "Chase",
  general: "Task",
};

/** £350 trade survey fee, recorded against lift-company enquiries and credited on win. */
export const TRADE_SURVEY_FEE_PENCE = 350_00;

/** Days after a quote is sent. Calendar days, pending confirmation in the design session. */
export const FOLLOW_UP_RULES = [
  { key: "d4", offsetDays: 4, kind: "email", title: "Day 4 follow-up email" },
  { key: "d10", offsetDays: 10, kind: "call", title: "Day 10 follow-up call" },
] as const satisfies readonly { key: string; offsetDays: number; kind: TaskKind; title: string }[];
export const QUOTE_ESCALATION_DAYS = 14;

export const PROJECT_STATUSES = ["awaiting_po", "live", "complete", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  awaiting_po: "Awaiting PO",
  live: "Live",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const MILESTONE_KINDS = ["deposit", "mid", "final"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
export const MILESTONE_LABELS: Record<MilestoneKind, string> = {
  deposit: "60% deposit",
  mid: "20% mid invoice",
  final: "Final 20%",
};
export const DEFAULT_BILLING_SPLIT: Record<MilestoneKind, number> = { deposit: 60, mid: 20, final: 20 };

export const MILESTONE_STATUSES = ["scheduled", "raised", "paid"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
