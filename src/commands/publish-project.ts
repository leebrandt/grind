import { $ } from "bun";
import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { hasUncommittedChanges } from "../utils/git.js";

/**
 * Publish a project by merging to main
 * grind publish project <name> [-d] [-D]
 */
export async function publishProject(
  projectName: string,
  options?: { deleteWorktree?: boolean; deleteBranch?: boolean }
): Promise<void> {
  // 1. Find workspace root and main worktree
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  // 2. Verify project worktree exists
  const worktreePath = path.join(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    console.error(`Error: Project worktree '${projectName}' does not exist.`);
    process.exit(1);
  }

  // 3. Check for uncommitted changes in both worktrees
  if (await hasUncommittedChanges(mainWorktree)) {
    console.error("Error: Main worktree has uncommitted changes. Please commit or stash them first.");
    process.exit(1);
  }
  if (await hasUncommittedChanges(worktreePath)) {
    console.error(`Error: Project '${projectName}' has uncommitted changes. Please commit or stash them first.`);
    process.exit(1);
  }

  // 4. Switch to main branch in grind/ worktree
  try {
    await $`git -C ${mainWorktree} switch main`.quiet();
  } catch (error) {
    console.error("Error: Could not switch to main branch. Is it checked out in another worktree?");
    process.exit(1);
  }

  // 5. Merge project branch into main
  console.log(`Publishing project '${projectName}'...`);
  console.log(`Merging branch '${projectName}' into main...`);

  try {
    await $`git -C ${mainWorktree} merge ${projectName}`.quiet();
    console.log("Merge completed successfully.");
  } catch (error) {
    console.error(`Error: Merge failed. Please resolve conflicts manually in ${mainWorktree}`);
    process.exit(1);
  }

  // 6. If -d or -D flag: remove worktree (and optionally branch)
  if (options?.deleteWorktree || options?.deleteBranch) {
    console.log("\nCleaning up worktree...");
    await $`git -C ${bareRepo} worktree remove ${worktreePath}`.quiet();
    console.log(`  - Removed worktree: ${worktreePath}`);

    if (options?.deleteBranch) {
      await $`git -C ${bareRepo} branch -D ${projectName}`.quiet();
      console.log(`  - Deleted branch: ${projectName}`);
    }

    console.log(`\nProject '${projectName}' published and archived.`);
  } else {
    console.log(`\nProject '${projectName}' published to main branch.`);
    console.log("Worktree and branch preserved for future work.");
  }
}
