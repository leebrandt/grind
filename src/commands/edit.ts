// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { execSync } from "node:child_process";
import { requireWorkspace } from "../utils/workspace.js";
import { getIdeaByNumber } from "../utils/files.js";

/**
 * Open an idea file in $EDITOR
 * grind edit idea <number>
 */
export async function editIdea(ideaNumber: string): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const index = parseInt(ideaNumber, 10);
  if (isNaN(index)) {
    console.error("Error: Idea must be a number from 'grind ideas'");
    process.exit(1);
  }

  const idea = await getIdeaByNumber(index);
  if (!idea) {
    console.error(`Error: Idea #${index} not found. Run 'grind ideas' to see available ideas.`);
    process.exit(1);
  }

  const filepath = path.join(mainWorktree, "ideas", idea.filename);
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  execSync(`${editor} ${filepath}`, { stdio: "inherit" });
}
