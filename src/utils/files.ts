import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findMainWorktree } from "./workspace.js";
import type { ProjectConfig } from "../types/index.js";

/**
 * Check if a file or directory exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an idea by its number from the ideas directory
 * @param ideaNumber 0-based index from 'grind list ideas'
 * @param includeRejected If true, include rejected ideas (files starting with "rejected-")
 * @returns Object with filename and content, or null if not found
 */
export async function getIdeaByNumber(
  ideaNumber: number,
  includeRejected: boolean = false
): Promise<{ filename: string; content: string } | null> {
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) return null;

  const ideasDir = path.join(mainWorktree, "ideas");
  let files = await readdir(ideasDir);
  files.sort();

  // Filter out rejected ideas unless explicitly requested
  if (!includeRejected) {
    files = files.filter(file => !file.startsWith("rejected-"));
  }

  // Use 0-based indexing directly
  if (ideaNumber < 0 || ideaNumber >= files.length) {
    return null;
  }

  const filename = files[ideaNumber];
  const filepath = path.join(ideasDir, filename);
  const content = await readFile(filepath, "utf-8");

  return { filename, content };
}

/**
 * Read project config from worktree
 */
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

/**
 * Write project config to worktree
 */
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
