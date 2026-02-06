// Project types - extend this array to add new types
export const PROJECT_TYPES = ["blog", "webapp", "video", "song", "book", "feature", "issue"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

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
  my?: ProfessionalInfo;
  currency?: string;
  paymentTerms?: string;
}

// .project.json schema
export interface ProjectConfig {
  name: string;
  type?: ProjectType;
  idea: string;
  time: Session[];
  billing: {
    roundTo: RoundTo;
    rate: number;
  };
  client?: ClientInfo;
  repo?: string;
}

// Command option types
export interface NewCommandOptions {
  type?: ProjectType;
}

// Validation helper
export function isValidProjectType(type: string): type is ProjectType {
  return PROJECT_TYPES.includes(type as ProjectType);
}
