# Spec 13: `read` Command Group — `grind read journal`

## Goal

Implement the `grind read journal` command: print every journal entry to stdout, oldest first, each preceded by a `─── <long-form date> ───` header. Output is plain text — no ANSI codes — so it pipes cleanly into `less`, nvim, `grep`, or a file. Also register the `read` command group (bare `grind read` shows help). This is the first command in the `read` group; `read idea` and `read project` are follow-ups (out of scope here).

This is the review-side counterpart to `grind journal` (which opens today's entry in `$EDITOR`). `grind journal` is **unchanged** by this spec.

## Files to create/modify

- `src/utils/journal.ts` — new: journal entry discovery/reading utilities
- `src/utils/time.ts` — add `formatLongDate()`
- `src/commands/read.ts` — new: `readJournal()` command
- `src/index.ts` — register the `read` command group
- `tests/utils/journal.test.ts` — new: util tests (mocked fs)
- `tests/utils/time.test.ts` — add `formatLongDate` describe block
- `tests/commands/read.test.ts` — new: command tests (exact output assertions, no snapshots)

## Changes

### 1. Add `formatLongDate()` to `src/utils/time.ts`

```typescript
/**
 * Long-form date header, e.g. "Tuesday, August 4, 2026".
 * Input is a YYYY-MM-DD string. Non-matching input is returned as-is.
 */
export function formatLongDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return dateString;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
```

Notes:

- Build the `Date` from parsed components via the local-time constructor (`new Date(year, month - 1, day)`), **not** `new Date("2026-08-04")`. The string form is parsed as UTC; formatting it with `toLocaleDateString` in a negative-offset timezone would render the previous day. Constructing from local components and formatting local components is timezone-independent and deterministic.
- Locale is fixed to `"en-US"` so the header is exactly `Tuesday, August 4, 2026` regardless of the user's system locale.
- Fallback: if the string doesn't match `YYYY-MM-DD`, return it unchanged (a stray non-journal file degrades gracefully instead of crashing).

### 2. Create `src/utils/journal.ts`

```typescript
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
```

Notes:

- `ENOENT` → `[]` because **reading never creates the journal directory** (PRD empty-state rule). Any other `readdir` failure propagates — standard error path, nothing special.
- No filtering of `.md` per the PRD assumption that only journal files live in `journal/`.

### 3. Create `src/commands/read.ts`

```typescript
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
```

Output assembly (exact):

- Each entry becomes one block: `` `─── ${date} ───\n\n` + content `` where `date` is the long-form date from the filename and `content` is the file's raw bytes **unmodified** — no trimming, no rendering, no ANSI.
- Blocks are joined with `\n\n` and printed with a single `console.log`. This yields exactly the PRD format:

```
─── Tuesday, August 4, 2026 ───

<raw contents of 2026-08-04.md>

─── Monday, August 3, 2026 ───

<raw contents of 2026-08-03.md>
```

- **Do not trim `content`.** If a file ends with a trailing newline, the raw content will add an extra blank line before the next header. That is expected — the PRD mandates unmodified raw contents.
- Empty entry (file exists, zero bytes): `content` is `""`, block is `─── date ───\n\n`, so the header still prints with its blank line.
- Empty journal: no `console.log` call at all; the function returns normally (exit 0).
- No color constants are imported or used anywhere in this command.

### 4. Register the `read` command group in `src/index.ts`

Add import with the other command imports:

```typescript
import { readJournal } from "./commands/read.js";
```

Add the command block immediately after the existing `grind journal` registration (lines ~420-426):

```typescript
// grind read journal [-r]
const readCmd = program
  .command("read")
  .description("Review journal, ideas, and projects");

readCmd
  .command("journal")
  .description("Print all journal entries to stdout (oldest first)")
  .option("-r, --reverse", "Print newest first")
  .action(async (options: { reverse?: boolean }) => {
    await readJournal(options);
  });

readCmd.action(() => {
  readCmd.help();
});
```

Notes:

- Bare `grind read` shows the group help and exits 0 — same behavior as bare `grind new` today. Use the explicit `readCmd.help()` action, matching the existing `edit` command group pattern (`src/index.ts` lines 311-317).
- Commander supports both subcommands and a parent `.action()`; `edit` is the existing precedent.

## Tests

Follow repo conventions: pure functions get pure tests; fs is mocked only at the `node:fs/promises` level; command output is asserted on exact strings, **no snapshots**.

### `tests/utils/time.test.ts` — add a `formatLongDate` describe block

- `formatLongDate("2026-08-04")` → `"Tuesday, August 4, 2026"`
- `formatLongDate("2026-01-01")` → `"Thursday, January 1, 2026"`
- `formatLongDate("2024-12-25")` → `"Wednesday, December 25, 2024"`
- Non-matching input passes through unchanged: `formatLongDate("notes")` → `"notes"`

### `tests/utils/journal.test.ts` — new

Mock `node:fs/promises` (`readdir`, `readFile`).

- `listJournalEntries`: returns filenames sorted chronologically regardless of `readdir` order (pass an unsorted array from the mock, expect sorted result)
- `listJournalEntries`: `readdir` rejects with `ENOENT` → returns `[]`
- `listJournalEntries`: `readdir` rejects with a non-ENOENT error → the error propagates (expect rejection)
- `readJournalEntry`: resolves with file content read from `path.join(journalDir, filename)`

### `tests/commands/read.test.ts` — new

Mock `requireWorkspace` (return `{ mainWorktree: "/w/grind" }`) and `node:fs/promises`; spy on `console.log` to capture output.

- **Oldest → newest with headers:** mock `readdir` → `["2026-08-03.md", "2026-08-04.md"]`, `readFile` → `"Monday entry."` / `"Wrote the spec.\n\nDone.\n"`. `listJournalEntries` sorts ascending, so the `2026-08-03` (Monday) block prints first. Assert the captured output is exactly:

```
─── Monday, August 3, 2026 ───

Monday entry.

─── Tuesday, August 4, 2026 ───

Wrote the spec.

Done.
```

- **Reverse (`-r`):** same mocks, `readJournal({ reverse: true })` → `entries.reverse()` puts `2026-08-04` (Tuesday) first. The Tuesday content ends with a trailing `\n`; per the "do not trim content" rule that raw newline yields an extra blank line before the Monday header. Assert the captured output is exactly:

```
─── Tuesday, August 4, 2026 ───

Wrote the spec.

Done.


─── Monday, August 3, 2026 ───

Monday entry.
```

(Note the two blank lines between `Done.` and the Monday header — expected from the unmodified trailing newline in `2026-08-04.md`.)
- **No ANSI:** assert `expect(output).not.toContain("\x1b[")`
- **Empty journal:** `readdir` → `[]` → `console.log` spy never called; no throw
- **Empty entry file:** `readFile` → `""` → header for that date still appears in output

## Dependencies

- Existing: `requireWorkspace()` (`src/utils/workspace.ts`), `getJournalDirPath()` (`src/utils/paths.ts`), `console.log` output convention
- No changes to `src/commands/journal.ts` or its registration — `grind journal` is untouched
- Out of scope (PRD): `read idea`, `read project`, color output, built-in pager, `-n` last-N, date filtering, markdown rendering, editing from the read view

## Verification

```bash
bun run typecheck
bun run test
bun run build
# Manual smoke test (in a workspace with at least two journal entries):
# grind read journal
# grind read journal -r
# grind read journal | grep -c .
# grind read            # shows read group help
# grind journal         # still opens today's entry in $EDITOR
```
