# PRD: `grind read journal`

## Overview

Add a command that prints every journal entry to stdout in chronological order, with a formatted date header between entries — reviewing your journal the way you'd read a real journal. This is the first command in a new `read` command group; `read idea` and `read project` are planned follow-ups (see Out of Scope).

## Motivation

`grind journal` opens today's entry in the editor — ideal for writing, useless for reviewing. Reviewing past entries today means manually locating and opening each `YYYY-MM-DD.md` file. This command makes the entire journal reviewable in one pass: `grind read journal | less` and page through months of entries, or pipe into nvim, `grep`, or a file.

## Commands

### `grind read journal`

Print every journal entry to stdout, oldest first, each preceded by a date header. The output is **plain text — no color/ANSI codes anywhere** — so it pipes cleanly into `less`, nvim, `grep`, or a file. (The user always pipes; no built-in pager.)

Output format (exact):

```
─── Tuesday, August 4, 2026 ───

<raw contents of 2026-08-04.md>

─── Monday, August 3, 2026 ───

<raw contents of 2026-08-03.md>
```

Rules:

- One header per entry: `─── ` + long-form date + ` ───`
  - Long-form date example: `Tuesday, August 4, 2026` (weekday, month, day, year)
  - The date is derived from the entry's filename (`2026-08-04` → `Tuesday, August 4, 2026`)
- A blank line after the header, then the entry's raw markdown content, unmodified
- A blank line before each header separates entries
- Entries print in chronological order (oldest → newest); since filenames are `YYYY-MM-DD.md`, filename order is chronological order
- An empty entry (file exists, no content) still shows its header
- No color, no styling, no markdown rendering — raw file contents

Flags:

| Flag | Description |
|------|-------------|
| `-r, --reverse` | Print newest first instead of oldest first |

### `grind read` (no subcommand)

Shows usage/help, same behavior as `grind new` bare today.

### Existing `grind journal` — unchanged

`grind journal` continues to open today's entry in `$EDITOR`. The two commands are complementary: write with `grind journal`, review with `grind read journal`.

## Empty state

If there are no journal entries, the command prints nothing and exits successfully (exit 0). Reading never creates the journal directory.

## Assumptions

- Journal entries are files named `YYYY-MM-DD.md` in the journal directory, auto-named by `grind journal`. No other files live there, so no filtering is needed.
- Entry dates come from filenames; filenames sort chronologically.

## Error handling

Any failure (e.g., the journal directory can't be read, an entry file can't be read) follows Grind's existing error conventions — standard error message path with the appropriate exit code. Nothing special.

## Out of Scope (v1)

- `grind read idea` and `grind read project` (planned follow-ups; `read project` may eventually absorb or retire `grind show`)
- Color/ANSI output (explicitly rejected — output is plain text)
- Built-in pager integration (user pipes: `grind read journal | less`)
- `-n <count>` last-N entries (possible follow-up)
- Date-range or single-date filtering
- Markdown rendering (bat/glow) — future consideration
- Editing entries from the read view

## Acceptance Criteria

1. `grind read journal` prints all entries, oldest → newest, with the `─── <long-form date> ───` header between entries and raw content below
2. `grind read journal -r` prints newest → oldest
3. Output contains no ANSI color codes
4. Empty journal → no output, exit 0
5. `grind read` with no subcommand shows usage
6. `grind journal` (open today in editor) still works as before
