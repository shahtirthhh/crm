import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  Inbox,
  KanbanSquare,
  ListChecks,
  PoundSterling,
  Ruler,
  Settings,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "followUps" | "triage";
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Sales",
    items: [
      { href: "/", label: "Today", icon: Sun },
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/enquiries", label: "Enquiries", icon: Inbox, badge: "triage" },
      { href: "/surveys", label: "Surveys", icon: Ruler },
      { href: "/quotes", label: "Quotes", icon: FileText },
      { href: "/follow-ups", label: "Follow-ups", icon: ListChecks, badge: "followUps" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: Wrench },
      { href: "/pipeline/monday", label: "Monday review", icon: CalendarCheck },
    ],
  },
  {
    label: "Finance",
    items: [{ href: "/billing", label: "Milestone billing", icon: PoundSterling }],
  },
  {
    label: "Records",
    items: [
      { href: "/clients", label: "Clients and sites", icon: Building2 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/projects", label: "Projects", icon: ClipboardList },
  { href: "/clients", label: "Clients", icon: Building2 },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/pipeline") return pathname === "/pipeline" || pathname === "/pipeline/list" || pathname === "/pipeline/closed" || pathname.startsWith("/opportunities");
  return pathname === href || pathname.startsWith(`${href}/`);
}
