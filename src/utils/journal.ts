// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

/**
 * List journal entry filenames in chronological order (oldest first).
 * Filenames are YYYY-MM-DD.md, so lexicographic sort is chronological.
 * Missing journal directory (ENOENT) is not an error: returns [].
 */
export async function listJournalEntries(journalDir: string): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(journalDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  files.sort();
  return files;
}

/**
 * Read a journal entry's raw markdown content, unmodified.
 */
export async function readJournalEntry(journalDir: string, filename: string): Promise<string> {
  return readFile(path.join(journalDir, filename), "utf-8");
}
