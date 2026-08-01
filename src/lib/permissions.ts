/** Shared, client-safe permission vocabulary (no DB access here). */

export const MODULES = [
  "deals",
  "proposals",
  "contracts",
  "invoices",
  "catalog",
  "staff",
  "costs",
  "analytics",
  "event_briefs",
  "lead_forms",
  "settings",
  "team",
] as const;

export type PermissionModule = (typeof MODULES)[number];

export const LEVELS = ["none", "view", "edit", "admin"] as const;
export type PermissionLevel = (typeof LEVELS)[number];

export type PermissionScope = "own" | "all";

export const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  admin: 3,
};

/** Modules where a record-level scope (own vs all) is meaningful. */
export const SCOPED_MODULES: PermissionModule[] = ["deals", "proposals", "contracts", "invoices", "event_briefs"];

export const MODULE_LABELS: Record<PermissionModule, string> = {
  deals: "Deals",
  proposals: "Proposals",
  contracts: "Contracts",
  invoices: "Invoices",
  catalog: "Catalog",
  staff: "Staff",
  costs: "Costs & margins",
  analytics: "Analytics",
  event_briefs: "Event briefs",
  lead_forms: "Lead forms",
  settings: "Settings",
  team: "Team & users",
};

export const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: "No access",
  view: "View",
  edit: "Edit",
  admin: "Admin",
};

export const CANONICAL_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "sales_manager", label: "Sales manager" },
  { value: "event_manager", label: "Event manager" },
  { value: "accounting", label: "Accounting" },
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number]["value"];

/** Non-owner roles are the only editable ones — owner is a super-admin. */
export const EDITABLE_ROLES = CANONICAL_ROLES.filter((r) => r.value !== "owner");

export function meetsLevel(actual: PermissionLevel | undefined | null, min: PermissionLevel): boolean {
  return LEVEL_RANK[actual ?? "none"] >= LEVEL_RANK[min];
}

export function roleLabel(role: string | null | undefined): string {
  const found = CANONICAL_ROLES.find((r) => r.value === role);
  if (found) return found.label;
  // legacy values kept in the enum for safety
  if (role === "sales") return "Sales manager";
  if (role === "manager") return "Event manager";
  return role ?? "—";
}
