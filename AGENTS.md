# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun install              # Install dependencies
bun run dev -- <args>    # Run CLI in dev mode (e.g., bun run dev -- new idea "test")
bun run build            # Compile to single binary named 'grind'
bun run typecheck        # Type check (tsc --noEmit)
bun run test             # Run tests (jest)
```

Tests use Jest with `ts-jest`. Test files live in `tests/` mirroring the `src/` structure (e.g., `tests/utils/config.test.ts`).

## Unit Testing Conventions

1. **Pure functions get pure tests**: `time.ts`, `errors.ts`, `types/index.ts` — test inputs/outputs, no mocking needed
2. **Utility functions that interact with git/fs**: Mock at the bun shell or fs level only (`jest.mock("bun")` / `jest.mock("node:fs/promises")`), not at the module level
3. **Commands that use utilities**: Test the utility logic, not the glue. If a command file is thin enough (delegating to utils), testing the util covers the behavior
4. **No process.exit in tests**: Catch thrown `GrindError` and assert on message + exit code
5. **Formatted output assertions**: The suite has **0 snapshots**. For formatted output (table layouts in list/status), assert on the formatted strings / `console.log` output directly (e.g. `expect(line).toContain(RED)`), not Jest snapshots
6. **Test file location**: Mirror `src/` structure in `tests/` (existing convention), e.g. `tests/utils/config.test.ts`

## Architecture

**Runtime:** TypeScript on Bun. Compiles to a single standalone binary via `bun build --compile`. Uses Bun's shell (`$` from "bun") for running git commands.

**CLI framework:** Commander.js. Entry point is `src/index.ts` which wires all commands. Commands are organized as async functions in `src/commands/`, one file per command group.

**Core concept — git worktrees as project isolation:** The central abstraction is using a bare git repo (`.grind.repo.git/`) with worktrees to give each project its own directory and branch while sharing history. The workspace layout is:

```
workspace-root/
├── .grind.repo.git/    # bare repo (shared git database)
├── grind/              # main worktree ("main" branch) — holds ideas, project configs, .grind.json
└── project-name/       # project worktree (one per project, own branch)
```

**Workspace discovery:** `src/utils/workspace.ts` walks up the directory tree looking for `.grind.repo.git` to locate the workspace root. All commands rely on this to find configs and project data regardless of where the user runs `grind`.

**Configuration hierarchy:**
- Workspace level: `grind/.grind.json` — billing defaults (rate, rounding)
- Project level: `grind/projects/{name}/.project.json` — per-project metadata, time sessions, billing overrides

**Config-on-main invariant:** project configs (`.project.json`) are written **only** in the main worktree and must always be **read from there** (`readProjectConfig`). The `projects/{name}/.project.json` copy on each project branch is frozen at worktree-creation time and must never be read. (`pullWorkspace`'s existing comment — "The config lives in the main worktree (single source of truth)" — states half of this; this doc makes it the contract. The actual migration, stripping frozen configs from project branches, is deferred to v2.)

**Time tracking:** Sessions are stored as start/end ISO timestamps in `.project.json`. Duration is calculated in seconds and rounded (quarter-hour/half-hour/hour) per `src/utils/time.ts`. Sessions can be marked as invoiced.

**Key types:** All domain types live in `src/types/index.ts` — `ProjectConfig`, `Session`, `Task`, `GrindConfig`, `BillingConfig`, `RoundTo`, `ProjectType`, `NewCommandOptions`, `ProfessionalInfo`, `ClientInfo`. Project types are defined as a const array (`PROJECT_TYPES`); extend that array to add new types. `ProjectConfig` includes optional `client` (ClientInfo), `repo` (git remote URL), `code` (code directory path), `publications` (published URL/date records), `longTerm` (boolean, shows ★ icon), `deadline` (ISO date string), and `status` (`active` | `canceled` | `published`) fields. `GrindConfig` includes optional `my` (ProfessionalInfo), `currency`, `paymentTerms`, `defaultBranch`, and `remote` (object with `url` for push/pull) fields.

**Utilities:**
- `src/utils/git.ts` — git command wrappers using Bun shell; `getActiveWorktrees()` lists project worktrees; `getDefaultBranch()` resolves branch name (config → detected → "main"); uses `execSync` for interactive editor spawning
- `src/utils/config.ts` — JSON config file read/write; `resolveProjectConfig()` reads the project config from the main-worktree path and returns `{ config, sourcePath }` (used by `invoice.ts`). Near-duplicate of `readProjectConfig` — kept, do not remove: it has live callers and tests
- `src/utils/editor.ts` — `openEditor()` (blocking), `openEditorDetached()` (non-blocking), `editTempFile()` (temp file lifecycle); resolves `$EDITOR → $VISUAL → "vi"`
- `src/utils/errors.ts` — `GrindError` (base, exit code), `GrindUserError` (exit 1, bad input), `GrindSystemError` (exit 2, I/O/git failures); each carries `message`, `exitCode`, optional `cause`
- `src/utils/files.ts` — filesystem helpers
- `src/utils/project.ts` — `collectProjects()` returns all active project worktrees with their configs (used by `list.ts`, `status.ts`)
- `src/utils/prompts.ts` — `confirmOrExit(prompt, skip)` prints y/N prompt and exits unless user confirms
- `src/utils/repo.ts` — parses git remote URLs (SSH/HTTPS) for GitHub and GitLab into `{ platform, repo }` format
- `src/utils/session.ts` — `getActiveSession()`, `startSession()`, `endSession()` for time-tracking session lifecycle
- `src/utils/time.ts` — timestamp generation, duration calculation, rounding, `timeAgo`/`formatDate` helpers
- `src/utils/workspace.ts` — workspace/worktree location logic; `requireWorkspace()` returns `{ workspaceRoot, mainWorktree, bareRepo }` or throws `GrindUserError`
- `src/utils/colors.ts` — shared ANSI color constants (`DIM`, `RED`, `GREEN`, `YELLOW`, `WHITE`, `RESET`)
- `src/utils/dates.ts` — flexible date parsing (`parseDate()`); accepts relative (`today`, `tomorrow`, `3d`, `2w`) and absolute (`YYYY-MM-DD`, `YYYYMMDD`, `MMDDYY`, `MMDD`) formats
- `src/utils/paths.ts` — centralized path constants for workspace structure (bare repo, main worktree, configs, ideas, journal, projects, invoices)
- `src/utils/task.ts` — task CRUD (`getTasks()`, `getOpenTasks()`, `addTask()`, `completeTask()`, `getTaskUrgency()`) for the native task/todo system

**Prompts:** `src/utils/prompts.ts` provides `confirmOrExit(prompt, skip)` — prints a y/N prompt and exits unless the user confirms, and `confirm(prompt, skip)` — returns `true`/`false` without exiting. Pass `skip=true` to bypass. The functions read stdin via `node:readline/promises`.

**Error handling:** All errors use the `GrindError` hierarchy defined in `src/utils/errors.ts`. `src/index.ts` wraps `program.parseAsync()` in a single try/catch — no `process.exit` calls exist in any command file. Errors exit with code 1 (user error) or 2 (system error), with stack traces for unexpected errors (exit 99).

**Workflow consolidation:** `grind work <project>` is the unified daily-driver command, supporting `-c` (code editor), `-q` (quiet, no timer), and `-s` (save). `grind edit <project>` and `grind code <project>` are thin aliases calling `workStart()` with appropriate flags. `grind save` accepts a positional `[hours]` or `-t <hours>` for time backfill (formats: `5`, `5h`, `90m`, `1h30m`) and `-y`/`-q` for auto-commit.

**Sync commands:** `grind push` and `grind pull` sync the main branch with a remote (configured via `GrindConfig.remote.url` or `-u` flag). `grind pull` also creates worktrees for any new project branches found on the remote.

**Cleanup:** `grind cleanup` removes stale remote and local branches that have no corresponding project config on main. Supports `--dry-run` and `-y` flags. `grind migrate` is a one-time migration utility for moving project configs from project worktrees to main.

**Tasks:** `grind tasks` provides a native todo system per project. `tasks list [project]` shows open tasks (or all with `-a`), `tasks add <project> "desc" [-d date]` creates a task, `tasks done <project> <id>` marks one complete. Tasks are stored in `.project.json` and support due dates with flexible parsing via `parseDate()`. `grind wwd` ("What we doing?") combines `status` + `tasks list` into a single dashboard.

**Journal:** `grind journal` opens today's markdown journal entry (`YYYY-MM-DD.md`) in `$EDITOR`, creating the `journal/` directory if needed.

**Confirmation model:** Destructive commands (`cancel`, `prune ideas`, `publish -d/-D`) use `confirmOrExit()` from `src/utils/prompts.ts`. Pass `-y`/`--yes` to skip the prompt. `-f`/`--force` is reserved for safety-skip semantics (uncommitted changes on `cancel`).

**Configurable default branch:** `GrindConfig.defaultBranch` sets the branch name; falls back to `git symbolic-ref HEAD` detection on the bare repo, then `"main"`. Resolution order: config → detected → `"main"`.

**Invoicing:** `src/commands/invoice.ts` generates both markdown and PDF (via pdfkit) invoices from tracked time sessions.

## Conventions

- Async/await throughout; file I/O uses `node:fs/promises`
- Config files are JSON with 2-space indentation
- Ideas are timestamped markdown files (`YYYYMMDDHHmmss.md`) in `grind/ideas/`
- Rejected ideas are prefixed with `rejected-` in the filename
- Error handling uses `GrindError` hierarchy (thrown in commands, caught in `src/index.ts`)
- The `config` command (`src/commands/config.ts`) supports `configList`, `configGet`, and `configSet` for both workspace-level (`-g`) and project-level configs
- Short aliases exist: `grind ideas` = `grind list ideas`, `grind projects` = `grind list projects`
- All `path` imports use the `node:path` prefix (Node.js built-in module convention)
