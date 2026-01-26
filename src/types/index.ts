// Project types - extend this array to add new types
export const PROJECT_TYPES = ["blog", "webapp", "video", "song"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

// Site configuration for publishing
export interface SiteConfig {
  url: string;
  publishedAt: string;
}

// .publish.json schema
export interface PublishConfig {
  projectType: ProjectType;
  slug: string;
  sites: {
    hip?: SiteConfig;
    gmh?: SiteConfig;
    [key: string]: SiteConfig | undefined;
  };
}

// Time tracking session
export interface Session {
  start: string; // ISO datetime
  end: string | null; // ISO datetime, null for active sessions
  duration: number; // seconds
  rounded: number; // rounded seconds
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

// .time.json schema
export interface TimeConfig {
  sessions: Session[];
  totalSeconds: number;
  billableHours: number;
  billing: BillingConfig;
}

// .project.json schema
export interface ProjectConfig {
  name: string;
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
