// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { getJournalDirPath } from "../utils/paths.js";
import { openEditorDetached } from "../utils/editor.js";

/**
 * Open today's journal entry in nvim
 * grind journal
 */
export async function journal(): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const journalDir = getJournalDirPath(mainWorktree);
  await mkdir(journalDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = path.join(journalDir, `${today}.md`);

  openEditorDetached(filePath);
}
