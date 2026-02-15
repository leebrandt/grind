// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { spawn } from "child_process";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";

/**
 * Open nvim in a project's working directory
 * grind edit <project-name>
 */
export async function edit(projectName: string): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const worktreePath = path.join(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    console.error(`Error: Project '${projectName}' does not exist.`);
    process.exit(1);
  }

  const projectDir = path.join(worktreePath, "projects", projectName);

  const editor = spawn("nvim", ["."], {
    cwd: projectDir,
    stdio: "inherit",
  });

  editor.on("close", (code) => {
    if (code !== 0) {
      console.error(`Editor exited with code ${code}`);
    }
  });
}
