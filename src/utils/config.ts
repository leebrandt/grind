import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GrindConfig } from "../types/index.js";
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
