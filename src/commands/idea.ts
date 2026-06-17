// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { readFile } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { GrindUserError } from "../utils/errors.js";
import { getProjectIdeaPath } from "../utils/paths.js";

export async function showIdea(projectName: string): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const ideaPath = getProjectIdeaPath(workspaceRoot, projectName);

  try {
    const content = await readFile(ideaPath, "utf-8");
    console.log(content);
  } catch {
    throw new GrindUserError(`No idea file found at ${ideaPath}`);
  }
}
