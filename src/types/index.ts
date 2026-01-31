// Project types - extend this array to add new types
export const PROJECT_TYPES = ["blog", "webapp", "video", "song", "book"] as const;
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

// Workspace-level config (.grind.json)
export interface GrindConfig {
  billing: {
    roundTo: RoundTo;
    defaultRate: number;
  };
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
}

// Command option types
export interface NewCommandOptions {
  type?: ProjectType;
}

// Validation helper
export function isValidProjectType(type: string): type is ProjectType {
  return PROJECT_TYPES.includes(type as ProjectType);
}
