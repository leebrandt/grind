import path from "path";
import { readFile, readdir } from "node:fs/promises";
import { findMainWorktree } from "../utils/workspace.js";

/**
 * List all idea files for triage
 * grind list ideas
 */
export async function listIdeas(): Promise<void> {
  // Find main worktree
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
  const ideasDir = path.join(mainWorktree, "ideas");
  
  // Get all files, sorted by filename (chronological)
  const files = await readdir(ideasDir);
  files.sort(); // Timestamp filenames sort chronologically
  
  if (files.length === 0) {
    console.log("No ideas yet. Create one with: grind new idea \"Your idea\"");
    return;
  }
  
  // Display numbered list
  for (let i = 0; i < files.length; i++) {
    const filepath = path.join(ideasDir, files[i]);
    const content = await readFile(filepath, "utf-8");
    const title = content.replace(/^#\s*/, "").trim(); // Remove leading # and whitespace
    
    console.log(`${i}. ${title}`);
  }
}

/**
 * List all projects (potential future command)
 * grind list projects
 */
export async function listProjects(): Promise<void> {
  console.log("TODO: List all projects");
  console.log("  - Read projects/ directory");
  console.log("  - Parse .publish.json for metadata");
  console.log("  - Display project name, type, status");
}
