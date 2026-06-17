// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { readdir, unlink } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { gitCommit } from "../utils/git.js";
import { confirmOrExit } from "../utils/prompts.js";
import { getIdeasDirPath } from "../utils/paths.js";

/**
 * Prune rejected ideas by deleting them
 * grind prune ideas [-y]
 */
export async function pruneIdeas(options?: { yes?: boolean }): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const ideasDir = getIdeasDirPath(mainWorktree);

  // Get all files
  const files = await readdir(ideasDir);

  // Filter for rejected ideas only
  const rejectedFiles = files.filter(file => file.startsWith("rejected-"));

  if (rejectedFiles.length === 0) {
    console.log("No rejected ideas to prune.");
    return;
  }

  // List what will be pruned
  console.log(`Found ${rejectedFiles.length} rejected idea(s) to prune:`);
  for (const file of rejectedFiles) {
    console.log(`  - ${file}`);
  }

  // Confirm before deleting
  await confirmOrExit(
    `Delete ${rejectedFiles.length} rejected idea(s)?`,
    options?.yes ?? false,
  );

  // Delete each rejected file
  for (const file of rejectedFiles) {
    const filepath = path.join(ideasDir, file);
    await unlink(filepath);
    console.log(`  - Deleted: ${file}`);
  }

  // Commit the changes
  await gitCommit(mainWorktree, `Prune ${rejectedFiles.length} rejected idea(s)`);
  console.log(`\nPruned ${rejectedFiles.length} rejected idea(s) and committed to main branch`);
}
