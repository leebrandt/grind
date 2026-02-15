// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { rename } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { getIdeaByNumber } from "../utils/files.js";
import { gitCommit } from "../utils/git.js";

/**
 * Reject an idea by prepending "rejected-" to filename
 * grind reject idea [number]
 */
export async function rejectIdea(ideaNumber: string): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  // Parse idea number
  const ideaIndex = parseInt(ideaNumber, 10);
  if (isNaN(ideaIndex)) {
    console.error("Error: Idea must be a number from 'grind list ideas'");
    process.exit(1);
  }

  // Get idea by number (non-rejected only)
  const idea = await getIdeaByNumber(ideaIndex, false);
  if (!idea) {
    console.error(`Error: Idea #${ideaIndex} not found. Run 'grind list ideas' to see available ideas.`);
    process.exit(1);
  }

  // Check if already rejected (shouldn't happen, but safety check)
  if (idea.filename.startsWith("rejected-")) {
    console.error(`Error: Idea #${ideaIndex} is already rejected.`);
    process.exit(1);
  }

  // Create new filename with "rejected-" prefix
  const ideasDir = path.join(mainWorktree, "ideas");
  const oldPath = path.join(ideasDir, idea.filename);
  const newFilename = `rejected-${idea.filename}`;
  const newPath = path.join(ideasDir, newFilename);

  // Rename the file
  await rename(oldPath, newPath);

  // Extract title for display
  const title = idea.content.replace(/^#\s*/, "").trim();

  console.log(`Rejected idea #${ideaIndex}: ${title}`);
  console.log(`Renamed: ${idea.filename} → ${newFilename}`);

  // Commit the change
  await gitCommit(mainWorktree, `Reject idea: ${title}`);
  console.log("Changes committed to main branch");
}
