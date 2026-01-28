import { mkdir, readdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findMainWorktree } from "./workspace.js";
import type { ProjectConfig } from "../types/index.js";

/**
 * Ensure a directory exists, creating it recursively if needed
 * - Creates parent directories if they don't exist (like mkdir -p)
 * - No error if directory already exists
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

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
 * List files in a directory with optional filtering
 */
export async function listFiles(
  dir: string,
  extension?: string
): Promise<string[]> {
  // TODO: List files, optionally filtered by extension
  console.log(`TODO: listFiles(${dir}, ${extension})`);
  return [];
}

/**
 * Generate a timestamped filename
 */
export function timestampedFilename(title: string, extension: string): string {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${timestamp}-${slug}.${extension}`;
}

/**
 * Get the grind root directory (where ideas/, projects/ live)
 */
export function getGrindRoot(): string {
  // TODO: Determine root from config or cwd
  return process.cwd();
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
