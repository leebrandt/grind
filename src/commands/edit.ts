// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { requireWorkspace } from "../utils/workspace.js";
import { getIdeaByNumber } from "../utils/files.js";
import { GrindUserError } from "../utils/errors.js";
import { openEditor } from "../utils/editor.js";
import { workStart } from "./work.js";
import { getIdeasDirPath } from "../utils/paths.js";

/**
 * Open an idea file in $EDITOR
 * grind edit idea <number>
 */
export async function editIdea(ideaNumber: string): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const index = parseInt(ideaNumber, 10);
  if (isNaN(index)) {
    throw new GrindUserError("Idea must be a number from 'grind ideas'");
  }

  const idea = await getIdeaByNumber(index);
  if (!idea) {
    throw new GrindUserError(`Idea #${index} not found. Run 'grind ideas' to see available ideas.`);
  }

  const filepath = path.join(getIdeasDirPath(mainWorktree), idea.filename);
  await openEditor(filepath);
}

/**
 * Open a project's writing directory in editor (no timer)
 * grind edit <project>
 */
export async function editProject(projectName: string): Promise<void> {
  await workStart(projectName, { quiet: true });
}
