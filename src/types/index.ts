// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// Default project types (used if not overridden in workspace config)
export const DEFAULT_PROJECT_TYPES = ["blog", "webapp", "video", "song", "book", "feature", "issue"] as const;
export type ProjectType = (typeof DEFAULT_PROJECT_TYPES)[number];

// Backward compatibility alias
export const PROJECT_TYPES = DEFAULT_PROJECT_TYPES;

// Time tracking session
export interface Session {
  start: string; // ISO datetime
  end: string | null; // ISO datetime, null for active sessions
  duration: number; // seconds
  rounded: number; // rounded seconds
  invoiced?: boolean; // true if this session has been billed
}

// Rounding options
export const ROUND_TO_OPTIONS = ["quarter-hour", "half-hour", "hour"] as const;
export type RoundTo = (typeof ROUND_TO_OPTIONS)[number];

// Billing configuration (project-level, can override workspace defaults)
export interface BillingConfig {
  roundTo: RoundTo;
  rate?: number; // hourly rate, overrides workspace default
}

// Professional info (displayed on invoices as "FROM")
export interface ProfessionalInfo {
  name?: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}

// Client info (displayed on invoices as "TO")
export interface ClientInfo {
  contact?: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
}

// Workspace-level config (.grind.json)
export interface GrindConfig {
  billing: {
    roundTo: RoundTo;
    defaultRate: number;
  };
  defaultBranch?: string; // Custom default branch name (default: "main")
  projectTypes?: string[]; // Override default project types
  my?: ProfessionalInfo;
  currency?: string;
  paymentTerms?: string;
  remote?: {
    url?: string; // Remote URL for push/pull (e.g., git@github.com:user/workspace.git)
  };
}

// .project.json schema
export interface ProjectConfig {
  name: string;
  type?: string; // Can be any custom type defined in workspace config
  idea: string;
  time: Session[];
  billing: {
    roundTo: RoundTo;
    rate: number;
  };
  client?: ClientInfo;
  repo?: string;
  code?: string; // Directory containing code (opened by 'grind code')
  longTerm?: boolean;
  publications?: { url: string; publishedAt: string }[];
}

// Command option types
export interface NewCommandOptions {
  type?: string;
}

// Get effective project types (from config or defaults)
export function getEffectiveProjectTypes(config?: { projectTypes?: string[] }): readonly string[] {
  return config?.projectTypes?.length ? config.projectTypes : DEFAULT_PROJECT_TYPES;
}

// Validation helper
export function isValidProjectType(type: string, validTypes?: readonly string[]): type is ProjectType {
  const types = validTypes ?? DEFAULT_PROJECT_TYPES;
  return types.includes(type);
}
