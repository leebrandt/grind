---
title: The Grind CLI — Go Rewrite
version: 1.0
date_created: 2026-08-11
last_updated: 2026-08-11
owner: Lee
status: Final
---

# The Grind CLI — Go Rewrite — Product Requirements Document

## 1. Overview

The Grind CLI is a personal command-line tool for managing creative and technical projects from idea to publication. It uses git worktrees to isolate each project on its own branch while sharing one repository, and provides time tracking with billing, invoicing, a per-project task system, idea triage, journaling, and remote sync between machines.

This PRD defines a from-scratch reimplementation of The Grind CLI in Go. The Go version shall be behaviorally equivalent to the current TypeScript implementation (v0.9.4) as modified by the explicit decisions in this document, and shall operate on an existing workspace's data and git layout **without any migration** — drop-in compatibility.

The rewrite is the author's deliberate, hand-written exercise to learn Go on a tool he uses daily.

## 2. Problem Statement

The author built The Grind CLI (TypeScript on Bun) to dust off coding skills and learn to build software with AI. It succeeded — and became a daily productivity system. The side effect: writing code with AI at work has let his manual programming skills atrophy again, and he has wanted to learn Go since roughly 2012.

Without this project there is no vehicle to fix that: he needs a real, daily-used product to reimplement by hand, one small requirement at a time, the way a new hire learns a codebase. The existing tool must keep working during the transition — the rewrite cannot lose data, break his workspace, or require him to migrate anything.

## 3. Goals

- **G1 — Behavioral parity**: The Go version shall implement the full command surface of the TS version (v0.9.4), as modified by the decisions in this PRD (N2 save semantics, F2/F3/F4 fixes, no `migrate`).
- **G2 — Drop-in data compatibility**: The Go version shall read and write the existing `.grind.json`, `.project.json`, `ideas/`, `journal/`, and git worktree layout exactly, with no conversion step. The author shall be able to alternate between the TS binary and the Go binary on the same workspace.
- **G3 — Single binary**: The Go version shall ship as a single static executable with no runtime interpreter.
- **G4 — Linux support**: Linux is the only supported platform at launch. macOS support is deferred (expected to be trivial; the code shells out only to `git`).

## 4. Non-Goals

- This is not a feature expansion. The Go version adds no commands beyond the current surface.
- This is not a data-migration project. Workspaces are assumed to be on the current (config-on-main) layout; pre-refactor workspace layouts are out of scope. The `migrate` command is deliberately **not** ported.
- This is not a rewrite of git. The system `git` CLI remains a required runtime dependency for all repository operations.
- Windows is not supported. macOS is not supported at launch.
- This is not a multi-user product; there is no authentication, authorization, or sharing model beyond git remotes.
- `read idea` and `read project` (planned follow-ups to `read journal`) are not in scope.
- Task features explicitly excluded in earlier design (undone, delete, edit, priorities, dependencies, recurring tasks, estimates, per-task time tracking) remain excluded.

## 5. Users

| User | Need | Context |
|------|------|---------|
| Lee (author, solo user) | Manage creative/technical projects from idea to publication; track time and billing; keep a journal; sync all work between desktop and laptop | Daily user of the existing TS version; comfortable with git, JSON, and the command line; the only user of the product |

## 6. Functional Requirements

Numbering is grouped by area. All commands resolve the workspace by walking up from the current directory to the first `.grind.repo.git`; commands run outside a workspace shall fail with a clear user error (REQ-003).

### 6.1 Workspace & configuration

- **REQ-001 (init)**: `grind init [-u <url>]` shall create a new workspace in the current directory: a bare repository `.grind.repo.git/`, a main worktree `grind/` on the default branch, `ideas/` and `projects/` directories, and a `.grind.json` containing the defaults `billing.roundTo = "quarter-hour"` and `billing.defaultRate = 150`. The initial structure shall be committed. With `-u`, the remote URL shall be recorded in the bare repo's git config and in `.grind.json`, and committed. `init` shall fail with a user error if the workspace is already initialized (`.grind.repo.git` exists).
- **REQ-002 (clone)**: `grind clone <url> [directory]` shall clone a remote grind workspace: bare-clone the remote, fix the fetch refspec, verify the clone is a grind workspace (`.grind.json` exists on the default branch), create the main worktree, record the remote URL, and restore worktrees for all projects whose config status is neither `canceled` nor `published`. The default branch shall be resolved from the remote's HEAD (see REQ-004); the clone shall not assume the branch is named `main`. On any failure before completion, the partially created directory shall be removed. The tool shall refuse to clone into an existing directory.
- **REQ-003 (workspace discovery)**: All commands except `init` and `clone` shall require an existing workspace, found by walking up the directory tree from the current directory to the first `.grind.repo.git`. The workspace root is the directory containing the bare repo; the main worktree is `grind/` inside it. Failure to find a workspace shall produce a user error.
- **REQ-004 (default branch)**: The workspace default branch shall be resolved in this order: (1) `defaultBranch` in `.grind.json`, (2) the bare repo's `symbolic-ref HEAD`, (3) `main`. All commands that operate on the default branch shall use this resolution.
- **REQ-005 (config command)**: `grind config` shall get, set, and list configuration values for either the workspace (`-g/--global`) or a project. The project may be given positionally or via `-p/--project <name>`; using both forms with conflicting values, or `-p` together with `-g`, shall be a user error. Keys use dot notation for nested values. Settable keys are allowlisted per scope:
  - Workspace: `billing.roundTo`, `billing.defaultRate`, `projectTypes`, `my.name`, `my.company`, `my.address`, `my.phone`, `my.email`, `my.taxId`, `currency`, `paymentTerms`.
  - Project: `type`, `billing.roundTo`, `billing.rate`, `client.contact`, `client.company`, `client.address`, `client.phone`, `client.email`, `repo`, `code`, `longTerm`, `deadline`.
  - Values shall be validated on set: `roundTo` ∈ {quarter-hour, half-hour, hour}; rates positive numbers; `longTerm` true/false; `deadline` a valid `YYYY-MM-DD`; `repo` a recognized GitHub/GitLab URL (REQ-091); `type` a valid project type; `projectTypes` a non-empty comma-separated list. `config --list` shall print all values for the selected scope. Getting or setting an unknown key shall be a user error.
- **REQ-006 (config-on-main invariant)**: All reads and writes of project configuration shall go to `grind/projects/{name}/.project.json` in the main worktree. Project branches shall never be read or written for configuration. (F2 — the Go version shall never create `.project.json` inside project branches; pre-existing stale copies in existing repositories' history are ignored.)

### 6.2 Ideas

- **REQ-010 (new idea)**: `grind new idea [title]` shall create a timestamped markdown file `YYYYMMDDHHmmss.md` in `ideas/`. With a title, the file shall contain that title as its first heading. Without a title, an editor shall be opened on a temp file whose first non-comment line becomes the title and remaining lines the body; aborting the editor (empty content) shall print an abort notice and make no changes. Only the new idea file shall be staged and committed (F4). The command shall print the created filename.
- **REQ-011 (list ideas)**: `grind list ideas` (alias `grind ideas`) shall list idea files in chronological filename order, one per line, numbered **0-based**, showing the title extracted from the first markdown heading (or "(no title)"). Default shall hide rejected ideas; `-a/--all` shall include them; `-r/--rejected` shall show only them. Rejected ideas shall be visibly marked as rejected. Empty states: no ideas → guidance to create one; no rejected ideas → a "none" message.
- **REQ-012 (reject idea)**: `grind reject idea <number>` shall rename the idea file with a `rejected-` prefix, refuse to run on an already-rejected idea, stage only the old and new paths, and commit. The displayed title and rename shall be printed.
- **REQ-013 (prune ideas)**: `grind prune ideas` shall delete all `rejected-` files after confirmation (`-y/--yes` skips). With no rejected ideas, it shall print a "none" message and do nothing. Only the deleted paths shall be staged and committed.
- **REQ-014 (edit idea)**: `grind edit idea <number>` shall open the idea file in the user's editor (REQ NFR-003). Unknown number or non-numeric input shall be a user error.

### 6.3 Projects

- **REQ-020 (new project)**: `grind new project <name> <idea-number> [-t <type>]` shall create a project from an existing idea. It shall fail fast with a user error if the main worktree has uncommitted changes, if the idea number is invalid, if the project directory already exists, or (with `-t`) if the type is not valid. It shall: create `grind/projects/{name}/` on main with `.project.json` (name, type, idea content, empty `time`, billing inherited from workspace defaults) and `the-idea.md`; commit on main; create a worktree at `{workspace}/{name}/` on a new branch named after the project (tracking the remote branch of the same name if one exists); delete the idea file and commit; print the created paths and branch, then relist remaining ideas. **The project branch shall not carry `.project.json`** (F2): the config exists only on main.
- **REQ-021 (list projects)**: `grind list projects` (alias `grind projects`) shall list active projects (worktrees with a readable config) in a table with columns Project, Type, Hours, Sessions, Last Worked. Sort: never-worked projects first, then by last session start ascending (most neglected first), then name. Long-term projects shall be marked with a ★ prefix. Total hours shall display unbilled hours when any exist. Projects with an open session shall be visually highlighted.
- **REQ-022 (show)**: `grind show <project>` shall print the project's `the-idea.md` by default. Flags: `-s/--sessions` prints each session (start → end, hours, invoiced marker; "active" for open sessions; "none" if no sessions); `-b/--billing` prints session count, total/billed/unbilled hours and amounts, and hourly rate; `--config` prints the raw project config JSON. Missing config or idea file shall be a user error.
- **REQ-023 (publish)**: `grind publish <name> [-d] [-D] [-u <url>] [-y]` shall mark a project published and merge its branch into the default branch. It shall fail fast with a user error if either worktree has uncommitted changes. It shall: optionally record the publication URL and timestamp in `publications`; set `status = "published"` in the config; commit the config on main; switch the main worktree to the default branch; merge the project branch into it (a merge conflict shall surface as a system error telling the user to resolve manually). With `-d`, the project worktree shall be removed after confirmation; with `-D`, the local and remote branches shall also be deleted. Without `-d/-D`, worktree and branch are preserved.
- **REQ-024 (cancel)**: `grind cancel <name> [-f] [-y]` shall abandon a project: after confirmation, remove the worktree (with `-f` forcing despite uncommitted changes), delete the local branch and (best-effort) the remote branch, set `status = "canceled"` in the config, and commit. It shall refuse to run when the current directory is inside the project's worktree. Failure to remove the worktree without `-f` shall be a user error suggesting `--force`.

### 6.4 Work & time tracking

- **REQ-030 (work)**: `grind work <project> [-c] [-q] [-s]` shall open the project's writing directory `{workspace}/{name}/projects/{name}/` in the editor. `-c/--code` shall instead open the configured code directory (absolute, or relative to the project worktree), requiring the `code` config key and an existing directory. `-q/--quiet` shall open without starting a timer. Without `-q`, an active session shall be continued (with its start time printed) or a new session started (start time printed), and the config written. `-s/--save` shall delegate to `save` and shall not combine with `-c` or `-q` (user error). Nonexistent project shall be a user error.
- **REQ-031 (aliases)**: `grind edit <project>` shall behave as `grind work <project> -q`. `grind code <project>` shall behave as `grind work <project> -c -q`. Bare `grind edit` shall print command help.
- **REQ-032 (save — intended behavior, differs from TS version)**: `grind save <project> [hours] [-q] [-y] [-t <hours>] [--no-push]` shall:
  1. End the active session (REQ-033) and write the config.
  2. If the project worktree has uncommitted changes, commit **all of them to the project's branch**. The commit message shall be authored interactively unless `-q`/`-y` is given, in which case an auto-generated message recording the session (rounded hours) and warning that the work may be unfinished shall be used. A project with no changes shall report "no changes" rather than creating an empty commit.
  3. Commit the config change on main, staging **only the project's config file**; unrelated main-worktree changes stay uncommitted (they surface via `grind save grind` or `grind push`).
  4. Unless `--no-push`, push the project branch and the default branch (and tags) to the configured remote (REQ-080). With no remote configured, skip pushing silently.
  - Backfill: the positional `[hours]` and `-t <hours>` are alternative forms (combining them is a user error). Valid formats: `5`, `5h`, `1.5h`, `90m`, `1h30m`; must be positive. Backfill sets the session end to session start + N hours. With backfill requested but no active session, the session is not created and a warning is printed; the commit/push steps still proceed.
  - The output shall report the stopped session's actual and rounded duration (or the no-session warning), the commit outcome, and the push outcome.
  - **Special case `grind save grind`**: commit all main-worktree changes (interactive or auto message as above) and push the default branch, subject to `--no-push`.
- **REQ-033 (session model)**: A session records `start` (UTC ISO timestamp) and `end` (`null` while active), `duration` (whole seconds, floored) and `rounded` (REQ-034). Sessions append to `time` in the project config; an active session is one with `end = null`; at most one active session per project. Sessions may be marked `invoiced` (REQ-070). Sessions are never edited or deleted by commands.
- **REQ-034 (rounding)**: Rounding is **ceiling-based** (always rounds up to the next boundary). Quarter-hour = 900 s, half-hour = 1800 s, hour = 3600 s, per the project's `billing.roundTo` (inherited from workspace at project creation, overridable per project).

### 6.5 Tasks

- **REQ-040 (tasks list)**: `grind tasks list [project] [-a]` shall list open tasks (all open tasks across projects, or a single project's). Columns: `#`, Project (all-projects view only), Task, Due. Sorted by due date ascending; tasks without a due date sort last. `-a/--all` includes completed tasks, shown dimmed. Empty states: all-projects → "all caught up" message; single project → guidance to add a task. `tasks list` and `tasks` aliases are equivalent to `tasks list` (per REQ-041/042 subcommands may also be given as `tasks <project> add|done`).
- **REQ-041 (tasks add)**: `grind tasks add <project> <description> [-d <date>]` shall append a task with the next sequential ID (max existing + 1), `createdAt` set to now, and optional `dueDate` parsed per the flexible date format (REQ-060-adjacent; see Data Contracts §8.6). IDs are **per-project** and **never reused**. Output: confirmation with the new task's ID.
- **REQ-042 (tasks done)**: `grind tasks done <project> <id>` shall set `done = true` and `completedAt`. The project is required because IDs are not globally unique. Invalid project, non-numeric ID, or missing task shall be a user error. Output: confirmation with the completed task's ID.
- **REQ-043 (task urgency & colors)**: Urgency is derived from due dates: overdue (due date before today), today, soon (within 3 days), none. Colors (semantic): overdue → red; due today → red; due within 3 days → yellow; 4+ days → green; no due date → plain. The "today" comparison shall use the local calendar date.

### 6.6 Dashboards

- **REQ-050 (status)**: `grind status` shall print a table of all active projects with columns Project, Worked, Billed, Tasks, Last Session, Last Commit. Sort order: non-long-term projects first, then total worked time (rounded seconds) descending, then name ascending. Long-term projects marked with ★. Project-name color semantics: active session → green; deadline overdue → red; deadline within 7 days → yellow; unbilled time exists → yellow; otherwise default. Tasks column colored red when any task is overdue, yellow when any is due today. Worked/Billed show hours (1 decimal); Last Session and Last Commit show relative time ("never" when absent). No active projects → guidance to create one.
- **REQ-051 (wwd)**: `grind wwd` shall print the status table, a separator line, then the all-projects open-task list.

### 6.7 Journal

- **REQ-060 (journal)**: `grind journal` shall open today's entry `journal/YYYY-MM-DD.md` (local date) in the editor, creating the journal directory if needed.
- **REQ-061 (read journal)**: `grind read journal [-r]` shall print every journal entry to stdout, oldest first (`-r` reverses), each preceded by a header `─── <long-form date> ───` (e.g. "Tuesday, August 4, 2026") derived from the filename, followed by the entry's raw contents unmodified (no trimming, no rendering). Output shall contain no ANSI/color codes. Empty entries still show their header. No entries → print nothing, exit 0. Reading shall never create the journal directory. Bare `grind read` shall print command help.

### 6.8 Invoicing

- **REQ-070 (invoice)**: `grind invoice <project>` shall invoice all **ended, unbilled** sessions. It shall: group sessions by start date; print the per-date hours and total hours × rate = amount; build an invoice (markdown and PDF) containing FROM (workspace `my.*` professional info), TO (project `client.*`), project name and description (first line of the idea, truncated to 100 characters), a per-date breakdown, subtotal/total, payment terms, and due date. Due date = invoice date + days, where terms parse as "Net N" → N days, "due on receipt" → 0 days, anything else → 30 days. Currency symbol per `currency` (USD/EUR/GBP get symbols; others a prefix). Invoice files shall be written under `grind/projects/{name}/invoices/{invoice-id}/` (invoice ID derived from the timestamp). All invoiced sessions shall be marked `invoiced`, and the invoice files plus config shall be committed on main. No unbilled sessions → a "none" message, no files. Missing project → user error.

### 6.9 Remote sync

- **REQ-080 (push)**: `grind push [-u <url>]` shall ensure everything is committed and pushed so work can continue on another machine. Remote resolution: `-u` flag → `remote.url` in config → the bare repo's origin URL; none → user error with guidance. The origin shall be (re)set to the resolved URL. If the main worktree has uncommitted changes, they shall be auto-committed with a generated message. All local branches shall be pushed individually to matching remote branches; a failed normal push shall fall back to a force-with-lease push. Tags shall be pushed (best-effort). Results shall report per-branch success, force-pushed branches, and any failures. Branches whose worktrees have uncommitted changes shall be reported as a warning (not a failure) so the user knows they are not fully backed up.
- **REQ-081 (pull)**: `grind pull [-u <url>]` shall fetch all branches; fast-forward local branches whose remote is ahead (refreshing checked-out worktrees via fast-forward, or flagging them as diverged when local changes block it); merge the remote default branch into the main worktree (conflicts → warning, not failure); and create worktrees for any remote project branches missing locally, **skipping** projects whose config status is `canceled` or `published`. A dirty main worktree shall produce a warning suggesting `grind save grind` before pulling. Results shall report updated branches, diverged branches, created/skipped worktrees, and the main-branch outcome.
- **REQ-082 (cleanup)**: `grind cleanup [--dry-run] [-y]` shall identify and delete stale branches: remote branches (other than the default branch) with no corresponding project config directory on main, and orphaned local branches with no worktree and no config. `--dry-run` lists without deleting. Deletion requires confirmation (`-y` skips; declining aborts). Results report each deleted branch.

### 6.10 GitHub / GitLab integration

- **REQ-090 (new issue / new feature)**: `grind new issue <project> [-m <message>]` and `grind new feature <project> [-m <message>]` shall create an issue/feature on the project's configured `repo`. Without `-m`, an editor shall be opened on a temp file; empty content aborts. The title shall be prefixed `[ISSUE]` / `[FEATURE]`. The platform (`github`/`gitlab`) shall be parsed from the repo URL (REQ-091) and the corresponding `gh`/`glab` CLI invoked with the `owner/repo` slug. Missing `repo` config or an unrecognized repo URL shall be a user error with guidance.
- **REQ-091 (repo URL parsing)**: A repo URL shall be recognized as GitHub or GitLab in SSH form (`git@github.com:owner/repo.git`) or HTTPS form (`https://github.com/owner/repo[.git]`), producing platform + `owner/repo`. Anything else shall be rejected where the URL is validated (config `repo`, REQ-005; issue/feature creation).

## 7. Non-Functional Requirements

- **NFR-001**: The tool shall run on Linux. macOS is out of scope at launch.
- **NFR-002**: The tool shall ship as a single static executable with no runtime interpreter or language runtime required.
- **NFR-003**: Runtime dependencies: the `git` CLI (required for all repository operations); the `gh` or `glab` CLI (only for `new issue`/`new feature`); an editor, resolved `$EDITOR` → `$VISUAL` → `vi` (for editor-opening commands and interactive commit messages).
- **NFR-004**: Failures shall be distinguishable as user errors (invalid input, violated preconditions) vs. system errors (git/fs/network failures), reported as clear messages on stderr with a non-zero exit code; 0 shall mean success.
- **NFR-005**: Destructive operations (prune, cancel, publish deletion, cleanup) shall require interactive confirmation with a `y/N` prompt on stdin; `-y/--yes` skips the prompt; declining aborts the operation.
- **NFR-006**: The tool shall not corrupt workspace data if interrupted mid-operation; configuration and invoice writes shall be all-or-nothing at the file level.
- **NFR-007**: Command startup overhead shall be negligible (no interpreter warm-up).
- **NFR-008**: All data read/written shall remain byte-compatible with the TS version's formats (see §8). The TS and Go binaries may be used interchangeably on the same workspace.

## 8. Data Contracts & Interface Shapes

### 8.1 Workspace layout

```
workspace-root/
├── .grind.repo.git/          # bare repository (shared git database)
├── grind/                    # main worktree on the default branch
│   ├── .grind.json           # workspace configuration
│   ├── ideas/                # idea files, YYYYMMDDHHmmss.md (rejected- prefix = rejected)
│   ├── journal/              # journal entries, YYYY-MM-DD.md
│   └── projects/
│       └── {name}/
│           ├── .project.json # project configuration (single source of truth — main only)
│           ├── the-idea.md   # project's idea text
│           └── invoices/     # per-invoice output directories
└── {name}/                   # project worktree, branch = {name}
    └── projects/{name}/      # project's working files (writing/code directory)
```

### 8.2 CLI surface

| Command | Arguments | Flags |
|---|---|---|
| `init` | — | `-u <url>` |
| `clone` | `<url> [directory]` | — |
| `push` | — | `-u <url>` |
| `pull` | — | `-u <url>` |
| `cleanup` | — | `--dry-run`, `-y` |
| `config` | `[project] [key] [value]` | `-g`, `-l`, `-p <project>` |
| `new idea` | `[title]` | — |
| `new project` | `<name> <idea-number>` | `-t <type>` |
| `new issue` | `<project>` | `-m <message>` |
| `new feature` | `<project>` | `-m <message>` |
| `list ideas` (alias `ideas`) | — | `-a`, `-r` |
| `list projects` (alias `projects`) | — | — |
| `work` | `<project>` | `-c`, `-q`, `-s` |
| `edit` | `[target]`; subcommand `idea <number>` | — |
| `code` | `<project>` | — |
| `save` | `<project> [hours]` | `-q`, `-y`, `-t <hours>`, `--no-push` |
| `publish` | `<name>` | `-d`, `-D`, `-u <url>`, `-y` |
| `cancel` | `<name>` | `-f`, `-y` |
| `reject idea` | `<number>` | — |
| `prune ideas` | — | `-y` |
| `invoice` | `<project>` | — |
| `journal` | — | — |
| `read journal` | — | `-r` |
| `status` | — | — |
| `wwd` | — | — |
| `tasks list` | `[project]` | `-a` |
| `tasks add` | `<project> <description>` | `-d <date>` |
| `tasks done` | `<project> <id>` | — |
| `show` | `<project>` | `-s`, `-b`, `--config` |
| `--version` | — | `-v` |

Bare command groups (`new`, `edit`, `read`, `tasks`) with no subcommand shall print their help.

`grind --version` / `grind -v` shall print the version string `1.0.0` (resolved OQ-003).

### 8.3 `.grind.json` (workspace configuration)

```json
{
  "billing": {
    "roundTo": "quarter-hour",
    "defaultRate": 150
  },
  "defaultBranch": "main",
  "projectTypes": ["blog", "webapp", "video", "song", "book", "feature", "issue"],
  "my": { "name": "", "company": "", "address": "", "phone": "", "email": "", "taxId": "" },
  "currency": "USD",
  "paymentTerms": "Net 30",
  "remote": { "url": "" }
}
```

Fields: `billing.roundTo` (`quarter-hour`|`half-hour`|`hour`, required), `billing.defaultRate` (number, required), `defaultBranch` (optional), `projectTypes` (optional; overrides defaults), `my.*` (optional; professional info for invoices), `currency` (optional; default `USD`), `paymentTerms` (optional; default `Net 30`), `remote.url` (optional; push/pull remote).

Default project types: `blog`, `webapp`, `video`, `song`, `book`, `feature`, `issue`.

### 8.4 `.project.json` (project configuration)

```json
{
  "name": "my-blog",
  "type": "blog",
  "idea": "# Blog post about Rust\n\n...",
  "time": [
    {
      "start": "2026-08-01T10:00:00.000Z",
      "end": "2026-08-01T11:30:00.000Z",
      "duration": 5400,
      "rounded": 5400,
      "invoiced": false
    }
  ],
  "tasks": [
    { "id": 1, "description": "Write intro", "done": false, "createdAt": "2026-08-01T10:00:00.000Z", "dueDate": "2026-08-10" }
  ],
  "billing": { "roundTo": "quarter-hour", "rate": 150 },
  "client": { "contact": "", "company": "", "address": "", "phone": "", "email": "" },
  "repo": "git@github.com:owner/repo.git",
  "code": "src",
  "longTerm": false,
  "deadline": "2026-08-15",
  "publications": [{ "url": "https://example.com/post", "publishedAt": "2026-08-11T10:00:00.000Z" }],
  "status": "active"
}
```

- `name` (required), `type` (optional), `idea` (required at creation), `time` (array of Session, required), `tasks` (optional), `billing` (required: `roundTo`, `rate`), `client` (optional), `repo` (optional), `code` (optional), `longTerm` (optional bool), `deadline` (optional `YYYY-MM-DD`), `publications` (optional array of `{url, publishedAt}`), `status` (optional: `active`|`canceled`|`published`; absent means active).
- **Session**: `start` (UTC ISO), `end` (UTC ISO or `null`), `duration` (seconds, floor), `rounded` (seconds, ceiling per `roundTo`), `invoiced` (optional bool).
- **Task**: `id` (int, per-project sequential, never reused), `description`, `done` (bool), `createdAt` (ISO), `completedAt` (optional ISO), `dueDate` (optional `YYYY-MM-DD`).

### 8.5 Git contract

- Project branches are named after projects; the main worktree sits on the default branch (REQ-004).
- All repository operations are performed by invoking the system `git` CLI; the tool never reimplements git.
- Project configuration is read and written **only** at `grind/projects/{name}/.project.json` in the main worktree (REQ-006). Project branches never carry `.project.json` going forward.
- The tool performs these git operations: bare init, initial empty commit, worktree add/remove, branch delete (local/remote), merge, switch, rev-list/log, status, add, commit (including interactive commit via the user's editor), push (single branch, all branches, force-with-lease, delete, tags), fetch, remote get/set, symbolic-ref.

### 8.6 Date & duration formats

Flexible date input (`-d` on `tasks add`, deadline-adjacent fields): relative `today`, `tomorrow`, `Nd`/`Ndays`, `Nw`/`Nweeks`; absolute `YYYY-MM-DD`, `YYYYMMDD`, `MMDDYY`, `MMDD` (current year). All are normalized to `YYYY-MM-DD`. Invalid dates and unparseable input are user errors.

Duration backfill (`save` positional or `-t`): `5`, `5h`, `1.5h`, `90m`, `1h30m` (decimal hours; minutes divided by 60). Must be positive; invalid formats are user errors.

Rounding boundaries: quarter-hour 900 s, half-hour 1800 s, hour 3600 s; ceiling applied (REQ-034).

### 8.7 Output shapes (semantic contracts)

Exact strings are intentionally **not** pinned in this PRD (they may evolve during the rewrite; current TS output is captured in Appendix A as a non-binding reference). The following shapes are binding:

- **status**: table, columns Project / Worked / Billed / Tasks / Last Session / Last Commit; sort & color semantics per REQ-050.
- **tasks**: table, columns `#` / [Project] / Task / Due; sort & color semantics per REQ-040/043.
- **list projects**: table, columns Project / Type / Hours / Sessions / Last Worked; sort per REQ-021; ★ for long-term.
- **list ideas**: 0-based numbered list; `[REJECTED]` marker; empty states per REQ-011.
- **read journal**: `─── <long-form date> ───` header + raw content per entry; no ANSI (REQ-061).
- **save**: reports session duration (actual + rounded) or no-session warning; commit and push outcomes (REQ-032).
- **invoice**: reports unbilled session count, per-date hours, total hours × rate = amount, and output paths (REQ-070).
- **push/pull/cleanup**: per-item result reports as specified in REQ-080/081/082.
- Empty states and error messages: present, clear, and actionable (guidance included), per command requirements.

## 9. Acceptance Criteria

- **AC-001**: Given an existing TS-created workspace, When the Go binary runs `grind status`, Then it prints the same projects with the same hours/colors without modifying any files.
- **AC-002**: Given no workspace, When `grind status` (or any non-`init`/`clone` command) runs, Then it exits non-zero with a clear "not in a grind workspace" message.
- **AC-003**: Given an empty directory, When `grind init` runs, Then `.grind.repo.git/`, `grind/ideas/`, `grind/projects/`, and `grind/.grind.json` (quarter-hour, 150) exist; a second `grind init` fails.
- **AC-004**: Given an initialized workspace, When `grind new idea "Title"` runs, Then one timestamped markdown file is created and committed, containing `# Title`, and no other files are staged in that commit.
- **AC-005**: Given an idea exists, When `grind new project "p" 0 -t blog` runs, Then `grind/projects/p/.project.json` and `the-idea.md` exist on main, a worktree `p/` exists on branch `p`, the idea file is gone, and branch `p` contains no `.project.json`.
- **AC-006**: Given a project with uncommitted main-worktree changes, When `grind new project` runs, Then it fails with a user error and creates nothing.
- **AC-007**: Given a project, When `grind work p` then `grind save p` run, Then the session is recorded with `end` set and correct duration/rounded values; all project-worktree changes are committed to branch `p`; the config change is committed on main; and (with a remote configured, no `--no-push`) both branch `p` and the default branch are pushed.
- **AC-008**: Given `grind save p -t 2h` with no active session, Then no session is created, a warning is printed, and the commit/push steps still run.
- **AC-009**: Given `grind save p 1h30m` with an active session, Then the session ends at start + 1.5 hours.
- **AC-010**: Given `grind save p` with both `-t` and a positional hours value, Then it fails with a user error.
- **AC-011**: Given tasks with due dates today, in 2 days, and none, When `grind tasks list` runs, Then they sort due-first (no-due last) and the due column shows red/yellow/plain per REQ-043 using the local calendar date.
- **AC-012**: Given a completed task, When `grind tasks add p "x"` runs, Then the new task's ID is max+1 (no reuse of completed IDs).
- **AC-013**: Given `grind journal` has created entries, When `grind read journal` runs, Then output is plain text (no ANSI), oldest-first, with `─── <long-form date> ───` headers; `-r` reverses; an empty journal prints nothing and exits 0.
- **AC-014**: Given a project with ended, unbilled sessions, When `grind invoice p` runs, Then markdown and PDF invoices are written under `grind/projects/p/invoices/`, the sessions are marked `invoiced`, and the invoice files plus config are committed on main. A second `grind invoice p` reports no unbilled sessions.
- **AC-015**: Given a workspace whose config sets `paymentTerms` to "Net 7", When an invoice is generated, Then the invoice's due date is 7 days after the invoice date.
- **AC-016**: Given a remote configured and main-worktree changes uncommitted, When `grind push` runs, Then main is auto-committed and all branches are pushed (force-with-lease fallback on divergence), with per-branch results reported.
- **AC-017**: Given a remote with a new project branch, When `grind pull` runs, Then a worktree is created for it if its config status is not canceled/published; a canceled project's branch is skipped.
- **AC-018**: Given a workspace with a custom `defaultBranch`, When `grind clone` runs on its remote, Then the clone succeeds (no hardcoded `main` assumption) and the main worktree sits on the configured default branch.
- **AC-019**: Given a project with no `code` config, When `grind work p -c` runs, Then it fails with a user error showing how to set `code`.
- **AC-020**: Given the current directory is inside a project worktree, When `grind cancel p` runs, Then it refuses with guidance to change directory first.
- **AC-021**: Given `grind config -g billing.roundTo hour` then `grind config p billing.rate 100`, Then `.grind.json` and `p`'s config reflect the new values and `grind config p billing.rate` prints `100`; `grind config p billing.roundTo bogus` fails.
- **AC-022**: Given a config command with conflicting positional and `-p` project names, Then it fails with a user error.
- **AC-023**: Given any environment, When `grind --version` (or `grind -v`) runs, Then it prints `1.0.0` and exits 0.

## 10. Decision Log

All Open Questions resolved 2026-08-11. These are the deliberate deviations from the TS implementation (v0.9.4); the architect shall treat them as binding:

| # | Decision | Rationale |
|---|----------|-----------|
| D-001 | `grind save <project>` commits **all** changes in the project worktree to the project branch, then commits the config change on main, then pushes both the project branch and the default branch (+ tags) unless `--no-push`. | The TS version only committed main-worktree changes and pushed the default branch; the intended contract is "save = everything is committed and pushed so I can continue on my laptop." |
| D-002 | `save` stages **only the project's config file** on main; unrelated `grind/` edits stay uncommitted. | Cleaner; unrelated edits surface via `save grind` / `push`. |
| D-003 | `push` warns about (never fails on) branches with dirty worktrees. | Push must never block on local dirt; the warning tells the user what isn't fully backed up. |
| D-004 | Project branches shall never carry `.project.json` (configs on main only); the Go version never creates them, and pre-existing stale copies in existing repositories are ignored. | Fixes the stale-config design risk in the TS version. |
| D-005 | `clone` resolves the default branch from the remote HEAD instead of assuming `main`. | Fixes clone failing on workspaces with a custom default branch. |
| D-006 | `new idea` stages only the new idea file, not `git add -A`. | Fixes unrelated `grind/` edits being swept into idea commits. |
| D-007 | `migrate` is **not** ported. | The Go version never creates the old-layout (config-in-worktree) data it would migrate; pre-refactor layouts are out of scope. |
| D-008 | `--version` reports `1.0.0`. | New implementation line; signals the rewrite. |
| D-009 | `pull` merges the remote default branch into the main worktree non-fast-forward-only, so local main commits survive; conflicts warn rather than fail. | Preserves TS behavior; suits the laptop-sync workflow. |
| D-010 | `grind save grind` special case retained: commit all main-worktree changes, push the default branch. | The documented way to commit the main worktree. |

Per the review, the PRD pins behavioral *shapes* and semantics, not exact output strings (output may evolve during the rewrite); the architect shall pin exact strings at spec-writing time.

## 11. Out of Scope / Future Considerations

- **Future**: `read idea`, `read project` (may absorb `show`)
- **Future**: macOS support (expected trivial)
- **Future**: task features previously excluded (undone, delete, edit, priorities, dependencies, recurring, estimates, per-task time)
- **Explicitly not ported**: `migrate` (the Go version never creates the old-layout configs it migrates)
- **Out of scope**: pre-refactor (config-in-worktree) workspace layouts; Windows; multi-user features; anything not in the current TS command surface

---

## Appendix A — Current TS output reference (informational, non-binding)

Exact strings from the TS implementation (v0.9.4) for spec-level reference. These may evolve during the rewrite per F6; the architect shall pin exact strings at spec-writing time.

| Area | Current output (illustrative) |
|---|---|
| No workspace | `Error: Not in a grind workspace.` |
| status empty | `No active projects. Create one with: grind new project "name" <idea-number>` |
| list ideas empty | `No ideas yet. Create one with: grind new idea "Your idea"` |
| tasks all empty | `All caught up! No open tasks.` |
| tasks project empty | `No open tasks. Add one with: grind tasks add <project> "My task"` |
| reject | `Rejected idea #N: <title>` / `Renamed: <old> → <new>` |
| prune none | `No rejected ideas to prune.` |
| save stopped | `Stopped work session on '<project>'` / `Duration: X.XX hours (Y.YY hours rounded)` |
| save no session | `No active sessions found.` |
| backfill warning | `Warning: backfill of <input> ignored — no active session found to backfill for '<project>'.` |
| confirm prompt | `<prompt> (y/N)` |
| decline | `Error: Aborted.` |
| status table | `  Project   Worked  Billed  Tasks  Last Session  Last Commit` with `─` divider, `★ ` long-term prefix, 2-space indent, ANSI colors per REQ-050 |
| read journal header | `─── Tuesday, August 4, 2026 ───` |
| invoice summary | `Found N unbilled session(s):` / `Total: X.XX hours @ $RATE/hr = $AMOUNT` |
