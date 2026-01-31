import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { findMainWorktree } from "./workspace.js";

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

