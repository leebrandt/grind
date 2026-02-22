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

/**
 * Start working on a project
 * grind work "project-name" [-q|--quiet]
 */
export async function workStart(projectName: string, options?: { quiet?: boolean }): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  // Verify project worktree exists
  const worktreePath = path.join(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    console.error(`Error: Project '${projectName}' does not exist.`);
    process.exit(1);
  }

  // Read project config
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    console.error(`Error: Could not read .project.json for '${projectName}'.`);
    process.exit(1);
  }

  // Check for active session and auto-close with 0 duration if found
  const activeSession = config.time.find(s => s.end === null);
  if (activeSession) {
    console.log(`Warning: Found unclosed session. Auto-closing with 0 duration.`);
    activeSession.end = activeSession.start;
    activeSession.duration = 0;
    activeSession.rounded = 0;
  }

  // Add new session
  const newSession: Session = {
    start: getCurrentTimestamp(),
    end: null,
    duration: 0,
    rounded: 0
  };

  config.time.push(newSession);

  // Write updated config
  await writeProjectConfig(workspaceRoot, projectName, config);

  console.log(`Started work session on '${projectName}'`);
  console.log(`Time started: ${newSession.start}`);

  if (options?.quiet) return;

  // Open editor in project directory
  const projectDir = path.join(worktreePath, "projects", projectName);

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
