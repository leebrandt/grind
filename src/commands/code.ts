// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { getCurrentTimestamp } from "../utils/time.js";
import type { Session } from "../types/index.js";
import { GrindUserError } from "../utils/errors.js";
import { getProjectWorktreePath } from "../utils/paths.js";
import { openEditorDetached } from "../utils/editor.js";

/**
 * Open code editor in project's code directory & start work session
 * grind code <project-name>
 */
export async function openCode(projectName: string): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  // Verify project worktree exists
  const worktreePath = getProjectWorktreePath(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    throw new GrindUserError(`Project '${projectName}' does not exist.`);
  }

  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    throw new GrindUserError(`Could not read .project.json for '${projectName}'.`);
  }

  if (!config.code) {
    throw new GrindUserError(
      `No code directory set for '${projectName}'. Run:\n  grind config -p ${projectName} code <directory>`
    );
  }

  const codeDir = path.isAbsolute(config.code)
    ? config.code
    : path.join(worktreePath, config.code);

  if (!(await fileExists(codeDir))) {
    throw new GrindUserError(`Code directory '${codeDir}' does not exist.`);
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

  // Open code directory in editor
  openEditorDetached(codeDir);
}