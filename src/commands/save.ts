// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig, readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { getActiveSession, endSession } from "../utils/session.js";
import {
  gitCommit,
  gitCommitInteractive,
  hasUncommittedChanges,
  pushWorkspace,
  getDefaultBranch,
  getRemoteUrl,
  formatShellError,
} from "../utils/git.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";

export async function save(
  projectName: string,
  options?: { quiet?: boolean; time?: string; yes?: boolean; push?: boolean },
): Promise<void> {
  const { workspaceRoot, mainWorktree, bareRepo } = await requireWorkspace();

  if (projectName === "grind") {
    console.log("Saving grind worktree...");
    if (await hasUncommittedChanges(mainWorktree)) {
      await gitCommitInteractive(mainWorktree);
      console.log("Changes committed to main branch");
    } else {
      console.log("No changes to commit.");
    }

    if (options?.push !== false && await getRemoteUrl(bareRepo)) {
      try {
        const config = await readGrindConfig(mainWorktree);
        const defaultBranch = await getDefaultBranch(bareRepo, config);
        await pushWorkspace(bareRepo, defaultBranch);
        console.log("Pushed to remote.");
      } catch (e) {
        console.log(`Warning: could not push to remote: ${formatShellError(e)}`);
      }
    }
    return;
  }

  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    throw new GrindUserError(`Could not read .project.json for '${projectName}'.`);
  }

  let endTime: string | undefined;
  if (options?.time) {
    const hours = parseFloat(options.time);
    if (isNaN(hours) || hours <= 0) {
      throw new GrindUserError("Backfill time (-t) must be a positive number (hours as decimal).");
    }
    const activeSession = getActiveSession(config);
    if (activeSession) {
      const startMs = new Date(activeSession.start).getTime();
      endTime = new Date(startMs + hours * 3600 * 1000).toISOString();
    }
  }

  const endedSession = endSession(config, endTime);
  let roundedHours: string | undefined;

  if (endedSession) {
    await writeProjectConfig(workspaceRoot, projectName, config);

    const hours = (endedSession.duration / 3600).toFixed(2);
    roundedHours = (endedSession.rounded / 3600).toFixed(2);

    console.log(`Stopped work session on '${projectName}'`);
    console.log(`Duration: ${hours} hours (${roundedHours} hours rounded)`);
  } else {
    if (options?.time) {
      console.log(
        `Warning: -t ${options.time} ignored — no active session found to backfill for '${projectName}'.`,
      );
    }
    console.log("No active sessions found.");
  }

  if (await hasUncommittedChanges(mainWorktree)) {
    console.log(`Committing changes...`);

    const autoCommit = options?.quiet || options?.yes;

    if (autoCommit) {
      const timestamp = new Date().toLocaleString();
      const commitMessage = roundedHours
        ? `Work Session on ${timestamp}: ${roundedHours}h\n=== WARNING: May contain unfinished work. ===`
        : `Save on ${timestamp}\n=== WARNING: May contain unfinished work. ===`;
      await gitCommit(mainWorktree, commitMessage);
    } else {
      await gitCommitInteractive(mainWorktree);
    }

    console.log(`Changes committed to main branch`);
  } else {
    console.log("No changes to commit.");
  }

  // Push to remote
  if (options?.push !== false && await getRemoteUrl(bareRepo)) {
    try {
      const grindConfig = await readGrindConfig(mainWorktree);
      const defaultBranch = await getDefaultBranch(bareRepo, grindConfig);
      await pushWorkspace(bareRepo, defaultBranch);
      console.log("Pushed to remote.");
    } catch (e) {
      console.log(`Warning: could not push to remote: ${formatShellError(e)}`);
    }
  }
}
