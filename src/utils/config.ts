import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GrindConfig, BillingConfig } from "../types/index.js";
import { DEFAULT_GRIND_CONFIG } from "../commands/init.js";

/**
 * Read workspace config from .grind.json
 */
export async function readGrindConfig(rootPath: string): Promise<GrindConfig> {
  const configPath = path.join(rootPath, ".grind.json");
  
  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    // Return defaults if file doesn't exist or can't be read
    return DEFAULT_GRIND_CONFIG;
  }
}

/**
 * Get effective billing config by merging workspace defaults with project overrides
 */
export function getEffectiveBillingConfig(
  workspaceConfig: GrindConfig,
  projectBilling?: Partial<BillingConfig>
): BillingConfig & { rate: number } {
  return {
    roundTo: projectBilling?.roundTo ?? workspaceConfig.billing.roundTo,
    rate: projectBilling?.rate ?? workspaceConfig.billing.defaultRate,
  };
}

/**
 * Find the grind root directory by looking for .grind.json
 */
export async function findGrindRoot(startPath: string): Promise<string | null> {
  // TODO: Walk up directories looking for .grind.json
  console.log(`TODO: findGrindRoot(${startPath})`);
  return null;
}
