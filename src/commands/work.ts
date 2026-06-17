// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import { readProjectConfig, writeProjectConfig } from "../utils/config.js";
import { getActiveSession, startSession } from "../utils/session.js";
import { GrindUserError } from "../utils/errors.js";
import { openEditorDetached } from "../utils/editor.js";
import { save } from "./save.js";

export async function workStart(
  projectName: string,
  options?: { code?: boolean; quiet?: boolean; save?: boolean },
): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const worktreePath = path.join(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    throw new GrindUserError(`Project '${projectName}' does not exist.`);
  }

  if (options?.save) {
    if (options.code || options.quiet) {
      throw new GrindUserError("Cannot combine -s with -c or -q flags.");
    }
    await save(projectName, options);
    return;
  }

  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    throw new GrindUserError(`Could not read .project.json for '${projectName}'.`);
  }

  let targetDir: string;
  if (options?.code) {
    if (!config.code) {
      throw new GrindUserError(
        `No code directory set for '${projectName}'. Run:\n  grind config -p ${projectName} code <directory>`,
      );
    }
    targetDir = path.isAbsolute(config.code)
      ? config.code
      : path.join(worktreePath, config.code);
    if (!(await fileExists(targetDir))) {
      throw new GrindUserError(`Code directory '${targetDir}' does not exist.`);
    }
  } else {
    targetDir = path.join(worktreePath, "projects", projectName);
  }

  if (!options?.quiet) {
    const activeSession = getActiveSession(config);
    if (activeSession) {
      console.log(`Continuing session on '${projectName}'`);
      console.log(`Session started: ${activeSession.start}`);
    } else {
      const newSession = startSession(config);
      console.log(`Started work session on '${projectName}'`);
      console.log(`Time started: ${newSession.start}`);
    }

    await writeProjectConfig(workspaceRoot, projectName, config);
  }

  await openEditorDetached(targetDir);
}
