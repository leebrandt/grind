// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { readFile } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";

export async function showIdea(projectName: string): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const ideaPath = path.join(workspaceRoot, projectName, "projects", projectName, "the-idea.md");

  try {
    const content = await readFile(ideaPath, "utf-8");
    console.log(content);
  } catch {
    console.error(`Error: No idea file found at ${ideaPath}`);
    process.exit(1);
  }
}
