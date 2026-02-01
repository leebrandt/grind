/**
 * Get or set configuration values
 *
 * grind config [key] [value]           # Project-level (in .project.json)
 * grind config -g [key] [value]        # Workspace-level (in .grind.json)
 * grind config --list                  # Show project config
 * grind config -g --list               # Show workspace config
 *
 * Keys (workspace-level, -g):
 *   billing.roundTo            - quarter-hour | half-hour | hour
 *   billing.defaultRate        - default hourly rate
 *   my.name          - your name
 *   my.company       - your company name
 *   my.address       - your address
 *   my.phone         - your phone number
 *   my.email         - your email address
 *   my.taxId         - tax ID (ABN/EIN/VAT)
 *   currency                   - currency code (e.g. USD, AUD)
 *   paymentTerms               - payment terms (e.g. "Net 30")
 *
 * Keys (project-level):
 *   type                       - project type
 *   billing.roundTo            - quarter-hour | half-hour | hour
 *   billing.rate               - hourly rate
 *   client.contact             - client contact person name
 *   client.company             - client company name
 *   client.address             - client address
 *   client.phone               - client phone number
 *   client.email               - client email address
 */

import { getWorkspaceRoot, findMainWorktree, getCurrentProjectName } from "../utils/workspace.js";
import { readGrindConfig, writeGrindConfig, readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { ROUND_TO_OPTIONS, PROJECT_TYPES, isValidProjectType } from "../types/index.js";
import type { RoundTo } from "../types/index.js";

export interface ConfigOptions {
  global?: boolean;
  project?: string;
  list?: boolean;
}

const GLOBAL_SETTABLE_KEYS = [
  "billing.roundTo", "billing.defaultRate",
  "my.name", "my.company", "my.address",
  "my.phone", "my.email", "my.taxId",
  "currency", "paymentTerms",
] as const;

const PROJECT_SETTABLE_KEYS = [
  "type", "billing.roundTo", "billing.rate",
  "client.contact", "client.company", "client.address",
  "client.phone", "client.email",
] as const;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, any>, key: string): unknown {
  const parts = key.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set a nested value on an object using dot notation
 */
function setNestedValue(obj: Record<string, any>, key: string, value: unknown): void {
  const parts = key.split(".");
  let current: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Flatten an object into dot-notation key=value pairs
 */
function flattenObject(obj: Record<string, any>, prefix = ""): { key: string; value: unknown }[] {
  const result: { key: string; value: unknown }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      result.push(...flattenObject(v, fullKey));
    } else {
      result.push({ key: fullKey, value: v });
    }
  }
  return result;
}

/**
 * Validate and parse a value for a given config key
 */
function validateValue(key: string, value: string, isGlobal: boolean): unknown {
  if (key === "type") {
    if (!isValidProjectType(value)) {
      console.error(`Invalid type: ${value}. Valid types: ${PROJECT_TYPES.join(", ")}`);
      process.exit(1);
    }
    return value;
  }

  if (key === "billing.roundTo") {
    if (!ROUND_TO_OPTIONS.includes(value as RoundTo)) {
      console.error(`Invalid roundTo value: ${value}. Valid options: ${ROUND_TO_OPTIONS.join(", ")}`);
      process.exit(1);
    }
    return value;
  }

  if (key === "billing.rate" || key === "billing.defaultRate") {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      console.error(`Invalid rate: ${value}. Must be a positive number.`);
      process.exit(1);
    }
    return num;
  }

  // String fields (my.*, client.*, currency, paymentTerms)
  return value;
}

/**
 * List all config values
 */
export async function configList(options: ConfigOptions): Promise<void> {
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Not in a grind workspace. Run 'grind init' first.");
    process.exit(1);
  }

  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Could not find main worktree.");
    process.exit(1);
  }

  const projectName = options.global ? null : (options.project ?? await getCurrentProjectName());
  const useGlobal = options.global || !projectName;

  if (useGlobal) {
    const config = await readGrindConfig(mainWorktree);
    const entries = flattenObject(config);
    for (const { key, value } of entries) {
      console.log(`${key} = ${value}`);
    }
  } else {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      console.error(`Could not read config for project: ${projectName}`);
      process.exit(1);
    }

    // Show type, billing, and client fields
    if (config.type) {
      console.log(`type = ${config.type}`);
    }
    const billingEntries = flattenObject(config.billing, "billing");
    for (const { key, value } of billingEntries) {
      console.log(`${key} = ${value}`);
    }
    if (config.client) {
      const clientEntries = flattenObject(config.client, "client");
      for (const { key, value } of clientEntries) {
        console.log(`${key} = ${value}`);
      }
    }
  }
}

/**
 * Get a config value
 */
export async function configGet(key: string, options: ConfigOptions): Promise<void> {
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Not in a grind workspace. Run 'grind init' first.");
    process.exit(1);
  }

  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Could not find main worktree.");
    process.exit(1);
  }

  const projectName = options.global ? null : (options.project ?? await getCurrentProjectName());
  const useGlobal = options.global || !projectName;

  if (useGlobal) {
    const config = await readGrindConfig(mainWorktree);
    const value = getNestedValue(config as Record<string, any>, key);
    if (value === undefined) {
      console.error(`Key not found: ${key}`);
      process.exit(1);
    }
    console.log(value);
  } else {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      console.error(`Could not read config for project: ${projectName}`);
      process.exit(1);
    }

    const value = getNestedValue(config as Record<string, any>, key);
    if (value === undefined) {
      console.error(`Key not found: ${key}`);
      process.exit(1);
    }
    console.log(value);
  }
}

/**
 * Set a config value
 */
export async function configSet(key: string, value: string, options: ConfigOptions): Promise<void> {
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Not in a grind workspace. Run 'grind init' first.");
    process.exit(1);
  }

  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Could not find main worktree.");
    process.exit(1);
  }

  const projectName = options.global ? null : (options.project ?? await getCurrentProjectName());
  const useGlobal = options.global || !projectName;

  if (useGlobal) {
    if (!GLOBAL_SETTABLE_KEYS.includes(key as typeof GLOBAL_SETTABLE_KEYS[number])) {
      console.error(`Invalid key for workspace config: ${key}`);
      console.error(`Valid keys: ${GLOBAL_SETTABLE_KEYS.join(", ")}`);
      process.exit(1);
    }

    const parsed = validateValue(key, value, true);
    const config = await readGrindConfig(mainWorktree);
    setNestedValue(config as Record<string, any>, key, parsed);
    await writeGrindConfig(mainWorktree, config);
    console.log(`${key} = ${parsed}`);
  } else {
    if (!PROJECT_SETTABLE_KEYS.includes(key as typeof PROJECT_SETTABLE_KEYS[number])) {
      console.error(`Invalid key for project config: ${key}`);
      console.error(`Valid keys: ${PROJECT_SETTABLE_KEYS.join(", ")}`);
      process.exit(1);
    }

    const parsed = validateValue(key, value, false);
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      console.error(`Could not read config for project: ${projectName}`);
      process.exit(1);
    }

    setNestedValue(config as Record<string, any>, key, parsed);
    await writeProjectConfig(workspaceRoot, projectName, config);
    console.log(`${key} = ${parsed}`);
  }
}
