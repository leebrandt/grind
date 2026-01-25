import { mkdir, readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { findMainWorktree } from "./workspace.js";

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
 * @param ideaNumber 0-based index from 'gd list ideas'
 * @returns Object with filename and content, or null if not found
 */
export async function getIdeaByNumber(ideaNumber: number): Promise<{ filename: string; content: string } | null> {
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) return null;
  
  const ideasDir = path.join(mainWorktree, "ideas");
  const files = await readdir(ideasDir);
  files.sort();
  
  // Use 0-based indexing directly
  if (ideaNumber < 0 || ideaNumber >= files.length) {
    return null;
  }
  
  const filename = files[ideaNumber];
  const filepath = path.join(ideasDir, filename);
  const content = await readFile(filepath, "utf-8");
  
  return { filename, content };
}
