import type { Role } from "./constants";

export const CAPABILITIES = [
  "opportunity:write",
  "opportunity:close",
  "client:write",
  "project:write",
  "billing:write",
  "settings:manage",
  "users:manage",
  "reports:view",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<Role, readonly Capability[]> = {
  admin: CAPABILITIES,
  md: CAPABILITIES,
  sales_admin: ["opportunity:write", "client:write", "reports:view"],
  project_manager: ["opportunity:write", "opportunity:close", "client:write", "project:write", "reports:view"],
  accounts: ["billing:write", "reports:view"],
  maintenance_manager: ["reports:view"],
  engineer: [],
};

export function can(role: Role | undefined | null, capability: Capability): boolean {
  return !!role && MATRIX[role]?.includes(capability);
}
