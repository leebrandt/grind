// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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
 *   projectTypes               - comma-separated list of project types (overrides defaults)
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
 *   repo                       - git remote URL (e.g. git@github.com:owner/repo.git, https://gitlab.com/owner/repo)
 *   code                       - code directory (relative to project, e.g. "src")
 *   longTerm                   - true | false (mark as long-term project)
 */

import { requireWorkspace, getCurrentProjectName } from "../utils/workspace.js";
import { readGrindConfig, writeGrindConfig, readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { ROUND_TO_OPTIONS, DEFAULT_PROJECT_TYPES, isValidProjectType } from "../types/index.js";
import type { RoundTo } from "../types/index.js";
import { parseRepoUrl } from "../utils/repo.js";
import { GrindUserError } from "../utils/errors.js";

export interface ConfigOptions {
  global?: boolean;
  project?: string;
  list?: boolean;
}

const GLOBAL_SETTABLE_KEYS = [
  "billing.roundTo", "billing.defaultRate",
  "projectTypes",
  "my.name", "my.company", "my.address",
  "my.phone", "my.email", "my.taxId",
  "currency", "paymentTerms",
] as const;

const PROJECT_SETTABLE_KEYS = [
  "type", "billing.roundTo", "billing.rate",
  "client.contact", "client.company", "client.address",
  "client.phone", "client.email", "repo", "code", "longTerm",
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
async function validateValue(key: string, value: string, isGlobal: boolean, mainWorktree: string): Promise<unknown> {
  if (key === "type") {
    const grindConfig = await readGrindConfig(mainWorktree);
    const validTypes = grindConfig?.projectTypes?.length 
      ? grindConfig.projectTypes 
      : DEFAULT_PROJECT_TYPES;
    if (!isValidProjectType(value, validTypes)) {
      throw new GrindUserError(`Invalid type: ${value}. Valid types: ${validTypes.join(", ")}`);
    }
    return value;
  }

  if (key === "projectTypes") {
    const types = value.split(",").map(t => t.trim()).filter(t => t);
    if (!types.length) {
      throw new GrindUserError(`Invalid projectTypes: ${value}. Must be a comma-separated list of types.`);
    }
    return types;
  }

  if (key === "billing.roundTo") {
    if (!ROUND_TO_OPTIONS.includes(value as RoundTo)) {
      throw new GrindUserError(`Invalid roundTo value: ${value}. Valid options: ${ROUND_TO_OPTIONS.join(", ")}`);
    }
    return value;
  }

  if (key === "billing.rate" || key === "billing.defaultRate") {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new GrindUserError(`Invalid rate: ${value}. Must be a positive number.`);
    }
    return num;
  }

  if (key === "repo") {
    if (!parseRepoUrl(value)) {
      throw new GrindUserError(
        `Invalid repo URL: ${value}\n` +
        "Expected a GitHub or GitLab URL, e.g.:\n" +
        "  git@github.com:owner/repo.git\n" +
        "  git@gitlab.com:owner/repo.git\n" +
        "  https://github.com/owner/repo\n" +
        "  https://gitlab.com/owner/repo"
      );
    }
    return value;
  }

  if (key === "longTerm") {
    if (value !== "true" && value !== "false") {
      throw new GrindUserError(`Invalid longTerm value: ${value}. Must be true or false.`);
    }
    return value === "true";
  }

  // String fields (my.*, client.*, currency, paymentTerms)
  return value;
}

/**
 * List all config values
 */
export async function configList(options: ConfigOptions): Promise<void> {
  const { workspaceRoot, mainWorktree } = await requireWorkspace();

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
      throw new GrindUserError(`Could not read config for project: ${projectName}`);
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
    if (config.repo) {
      console.log(`repo = ${config.repo}`);
    }
    if (config.code) {
      console.log(`code = ${config.code}`);
    }
    if (config.longTerm != null) {
      console.log(`longTerm = ${config.longTerm}`);
    }
  }
}

/**
 * Get a config value
 */
export async function configGet(key: string, options: ConfigOptions): Promise<void> {
  const { workspaceRoot, mainWorktree } = await requireWorkspace();

  const projectName = options.global ? null : (options.project ?? await getCurrentProjectName());
  const useGlobal = options.global || !projectName;

  if (useGlobal) {
    const config = await readGrindConfig(mainWorktree);
    const value = getNestedValue(config as Record<string, any>, key);
    if (value === undefined) {
      throw new GrindUserError(`Key not found: ${key}`);
    }
    console.log(value);
  } else {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      throw new GrindUserError(`Could not read config for project: ${projectName}`);
    }

    const value = getNestedValue(config as Record<string, any>, key);
    if (value === undefined) {
      throw new GrindUserError(`Key not found: ${key}`);
    }
    console.log(value);
  }
}

/**
 * Set a config value
 */
export async function configSet(key: string, value: string, options: ConfigOptions): Promise<void> {
  const { workspaceRoot, mainWorktree } = await requireWorkspace();

  const projectName = options.global ? null : (options.project ?? await getCurrentProjectName());
  const useGlobal = options.global || !projectName;

  const grindConfig = await readGrindConfig(mainWorktree);

  if (useGlobal) {
    if (!GLOBAL_SETTABLE_KEYS.includes(key as typeof GLOBAL_SETTABLE_KEYS[number])) {
      throw new GrindUserError(
        `Invalid key for workspace config: ${key}\n` +
        `Valid keys: ${GLOBAL_SETTABLE_KEYS.join(", ")}`
      );
    }

    const parsed = await validateValue(key, value, true, mainWorktree);
    setNestedValue(grindConfig as Record<string, any>, key, parsed);
    await writeGrindConfig(mainWorktree, grindConfig);
    console.log(`${key} = ${parsed}`);
  } else {
    if (!PROJECT_SETTABLE_KEYS.includes(key as typeof PROJECT_SETTABLE_KEYS[number])) {
      throw new GrindUserError(
        `Invalid key for project config: ${key}\n` +
        `Valid keys: ${PROJECT_SETTABLE_KEYS.join(", ")}`
      );
    }

    const parsed = await validateValue(key, value, false, mainWorktree);
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      throw new GrindUserError(`Could not read config for project: ${projectName}`);
    }

    setNestedValue(config as Record<string, any>, key, parsed);
    await writeProjectConfig(workspaceRoot, projectName, config);
    console.log(`${key} = ${parsed}`);
  }
}
