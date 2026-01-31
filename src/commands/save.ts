import path from "node:path";
import { getWorkspaceRoot } from "../utils/workspace.js";
import { readProjectConfig, writeProjectConfig } from "../utils/files.js";
import { getCurrentTimestamp, calculateDuration, roundTimeByStrategy } from "../utils/time.js";
import { gitCommit, gitCommitInteractive } from "../utils/git.js";

/**
 * Save work on a project
 * grind save "project" [-q|--quiet]
 * 
 * - Stops the timer
 * - Commits changes
 *   - Default: Opens interactive editor for commit message
 *   - With -q flag: Uses auto-generated message with warning
 */
export async function save(projectName: string, options?: { quiet?: boolean }): Promise<void> {
  // Find workspace root
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }

  const worktreePath = path.join(workspaceRoot, projectName);

  // The 'grind' worktree is the main worktree with no .project.json —
  // just stage and commit, no time tracking or billing.
  if (projectName === "grind") {
    console.log("Saving grind worktree...");
    await gitCommitInteractive(worktreePath);
    console.log("Changes committed to main branch");
    return;
  }

  // Read project config
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    console.error(`Error: Could not read .project.json for '${projectName}'.`);
    process.exit(1);
  }

  // Find active session
  const activeSession = config.time.find(s => s.end === null);
  if (!activeSession) {
    console.error(`Error: No active session found for '${projectName}'.`);
    process.exit(1);
  }

  // Stop the session
  const endTime = getCurrentTimestamp();
  activeSession.end = endTime;
  activeSession.duration = calculateDuration(activeSession.start, endTime);
  activeSession.rounded = roundTimeByStrategy(activeSession.duration, config.billing.roundTo);

  // Write updated config
  await writeProjectConfig(workspaceRoot, projectName, config);

  const hours = (activeSession.duration / 3600).toFixed(2);
  const roundedHours = (activeSession.rounded / 3600).toFixed(2);

  console.log(`Stopped work session on '${projectName}'`);
  console.log(`Duration: ${hours} hours (${roundedHours} hours rounded)`);

  console.log(`Committing changes...`);

  if (options?.quiet) {
    // Quick save with auto-generated message
    const timestamp = new Date().toLocaleString();
    const commitMessage = `Work Session on ${timestamp}: ${roundedHours}h\n=== WARNING: May contain unfinished work. ===`;
    await gitCommit(worktreePath, commitMessage);
  } else {
    // Interactive commit - open editor
    await gitCommitInteractive(worktreePath);
  }

  console.log(`Changes committed to ${projectName} branch`);
}
