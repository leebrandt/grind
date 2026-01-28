import path from "path";
import { readdir, unlink } from "node:fs/promises";
import { findMainWorktree } from "../utils/workspace.js";
import { gitCommit } from "../utils/git.js";

/**
 * Prune rejected ideas by deleting them
 * grind prune ideas
 */
export async function pruneIdeas(): Promise<void> {
  // Find main worktree
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
  const ideasDir = path.join(mainWorktree, "ideas");
  
  // Get all files
  const files = await readdir(ideasDir);
  
  // Filter for rejected ideas only
  const rejectedFiles = files.filter(file => file.startsWith("rejected-"));
  
  if (rejectedFiles.length === 0) {
    console.log("No rejected ideas to prune.");
    return;
  }
  
  // Delete each rejected file
  console.log(`Found ${rejectedFiles.length} rejected idea(s) to prune:`);
  for (const file of rejectedFiles) {
    const filepath = path.join(ideasDir, file);
    await unlink(filepath);
    console.log(`  - Deleted: ${file}`);
  }
  
  // Commit the changes
  await gitCommit(mainWorktree, `Prune ${rejectedFiles.length} rejected idea(s)`);
  console.log(`\nPruned ${rejectedFiles.length} rejected idea(s) and committed to main branch`);
}
