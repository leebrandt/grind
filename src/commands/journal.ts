// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { openEditorDetached } from "../utils/editor.js";
import { getJournalDirPath } from "../utils/paths.js";
import { toLocalDateString } from "../utils/time.js";

/**
 * Open today's journal entry in nvim
 * grind journal
 */
export async function journal(): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const journalDir = getJournalDirPath(mainWorktree);
  await mkdir(journalDir, { recursive: true });

  const today = toLocalDateString(); // local YYYY-MM-DD
  const filePath = path.join(journalDir, `${today}.md`);

  openEditorDetached(filePath);
}
