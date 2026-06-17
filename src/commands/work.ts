// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { spawn } from "node:child_process";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { getCurrentTimestamp } from "../utils/time.js";
import type { Session } from "../types/index.js";
import { GrindUserError } from "../utils/errors.js";
import { getProjectWorktreePath, getProjectFilesPath } from "../utils/paths.js";

/**
 * Start working on a project
 * grind work "project-name" [-q|--quiet]
 */
export async function workStart(projectName: string, options?: { quiet?: boolean }): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  // Verify project worktree exists
  const worktreePath = getProjectWorktreePath(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    throw new GrindUserError(`Project '${projectName}' does not exist.`);
  }

  if (!options?.quiet) {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      throw new GrindUserError(`Could not read .project.json for '${projectName}'.`);
    }

    // Check for active session - keep it open if exists (orphaned session)
    const activeSession = config.time.find(s => s.end === null);

    if (activeSession) {
      console.log(`Continuing session on '${projectName}'`);
      console.log(`Session started: ${activeSession.start}`);
    } else {
      // Add new session only if no orphaned session
      const newSession: Session = {
        start: getCurrentTimestamp(),
        end: null,
        duration: 0,
        rounded: 0
      };
      config.time.push(newSession);

      console.log(`Started work session on '${projectName}'`);
      console.log(`Time started: ${newSession.start}`);
    }

    // Write updated config
    await writeProjectConfig(workspaceRoot, projectName, config);
  }

  // Open editor in project directory
  const projectDir = getProjectFilesPath(workspaceRoot, projectName);

  // Spawn editor
  const editorCmd = process.env.EDITOR || process.env.VISUAL || "vi";
  const editor = spawn(editorCmd, ["."], {
    cwd: projectDir,
    stdio: "inherit"
  });

  editor.on("close", (code) => {
    if (code !== 0) {
      console.error(`Editor exited with code ${code}`);
    }
  });
}
