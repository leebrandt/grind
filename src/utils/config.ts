import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GrindConfig, ProjectConfig } from "../types/index.js";
import { DEFAULT_GRIND_CONFIG } from "../commands/init.js";

export async function readGrindConfig(rootPath: string): Promise<GrindConfig> {
  const configPath = path.join(rootPath, ".grind.json");

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw error;
  }
}

export async function writeGrindConfig(rootPath: string, config: GrindConfig): Promise<void> {
  const configPath = path.join(rootPath, ".grind.json");
  try{
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  }catch(error){
    throw error;
  }
}

export async function readProjectConfig(
  workspaceRoot: string,
  projectName: string
): Promise<ProjectConfig | null> {
  const configPath = path.join(
    workspaceRoot,
    projectName,
    "projects",
    projectName,
    ".project.json"
  );

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function writeProjectConfig(
  workspaceRoot: string,
  projectName: string,
  config: ProjectConfig
): Promise<void> {
  const configPath = path.join(
    workspaceRoot,
    projectName,
    "projects",
    projectName,
    ".project.json"
  );

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}
