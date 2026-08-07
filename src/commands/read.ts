// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { getJournalDirPath } from "../utils/paths.js";
import { listJournalEntries, readJournalEntry } from "../utils/journal.js";
import { formatLongDate } from "../utils/time.js";

/**
 * Print all journal entries to stdout, oldest first.
 * grind read journal [-r|--reverse]
 */
export async function readJournal(options: { reverse?: boolean }): Promise<void> {
  const { mainWorktree } = await requireWorkspace();
  const journalDir = getJournalDirPath(mainWorktree);

  const entries = await listJournalEntries(journalDir);
  if (options?.reverse) entries.reverse();

  if (entries.length === 0) return; // empty state: print nothing, exit 0

  const blocks: string[] = [];
  for (const entry of entries) {
    const content = await readJournalEntry(journalDir, entry);
    const date = entry.replace(/\.md$/, "");
    blocks.push(`─── ${formatLongDate(date)} ───\n\n${content}`);
  }
  console.log(blocks.join("\n\n"));
}
