# Code Review: grind — 2026-08-03

**Grind** is a CLI tool (TypeScript on Bun, compiled to a single binary via `bun build --compile`) for managing creative/technical projects from idea → publication, with git-worktree-based project isolation, time tracking, billing, tasks, journaling, and invoicing. Currently at **v0.9.1** on the `develop` branch, working tree clean.

## Verification status

| Check | Result |
|---|---|
| `bun run typecheck` (`tsc --noEmit`) | ✅ Clean |
| `bun run test` | ✅ 225 tests / 21 suites, all passing |
| CLI boots (help output) | ✅ All commands wired |

## Architecture summary

- **Core concept:** A bare repo (`.grind.repo.git/`) with git worktrees — `grind/` (main worktree, holds `.grind.json`, `ideas/`, `journal/`, and `projects/{name}/` configs) plus one worktree per project on its own branch.
- **CLI framework:** Commander.js; `src/index.ts` is a thin wiring layer; one file per command group in `src/commands/`.
- **Utilities** (`src/utils/`): `git.ts` (Bun-shell wrappers + workflow methods like `pullWorkspace`), `config.ts` (atomic JSON writes via temp+rename), `workspace.ts` (walks up tree for `.grind.repo.git`), `session.ts`/`time.ts` (session lifecycle + rounding), `task.ts`/`dates.ts` (native todo system), `project.ts`, `paths.ts`, `errors.ts`, `prompts.ts`, `table.ts`, `repo.ts`.
- **Error handling is excellent:** `GrindUserError` (exit 1), `GrindSystemError` (exit 2), unexpected → exit 99 with stack. No `process.exit()` in any command file — single try/catch in `index.ts`.
- **Specs:** 6 numbered specs + PRD in `specs/` (task system, status sort orders, long-term sort). Specs 5 & 6 are implemented in `status.ts` exactly as specified.

## Strengths

1. **Clean layering** — commands are thin, logic lives in utils; pure functions (`time.ts`, `errors.ts`, `dates.ts`) have pure tests.
2. **Safety-minded git handling** — `gitCommit` refuses to commit unmerged paths (protects the config-on-main architecture); `gitPushAll` falls back to `--force-with-lease`; errors are surfaced via `formatShellError` instead of being swallowed.
3. **Atomic config writes** (temp file + `rename`) protect against corruption mid-crash.
4. **Excellent test discipline** — mocks at the fs/bun level per documented conventions; 225 passing tests including sort-order and color-priority tests.
5. **Good documentation culture** — AGENTS.md, README, inline help text, and specs are all maintained.

## Issues found

### 🔴 Bug — `grind config -p <project>` doesn't exist (user-facing)

The CLI's `config` command takes the project as a **positional argument** (confirmed via `config --help`: only `-g`/`-l` flags exist). But the `-p` flag is referenced in three places:

- `README.md` lines 130–132: `grind config -p my-project repo git@github.com:owner/repo.git`
- `src/commands/work.ts:43` — error message telling users to run `grind config -p ${projectName} code <directory>`
- `src/commands/new.ts:209` — error message telling users to run `grind config -p ${projectName} repo ...`

Anyone following these instructions will hit Commander's `error: unknown option '-p'`. Fix: either add a `-p, --project` alias to the config command, or correct the docs/error messages to `grind config <project> <key> <value>`.

### 🟠 Correctness bugs

1. **Custom `defaultBranch` is broken in three places** — `getCommitCount`/`getFirstCommitDate` (`git.ts:128,140`) hardcode `--not main`, and `pullWorkspace` (`git.ts:511`) hardcodes `git merge origin/main`. Any workspace configured with `GrindConfig.defaultBranch ≠ main` gets wrong commit counts and a wrong pull merge. The config feature exists, so these should resolve the branch dynamically.

2. **Task "due today" uses UTC, not local time** — `getTaskUrgency` (`task.ts:74`) and `getDueColor` (`tasks.ts:40`) derive "today" from `toISOString().slice(0, 10)`. In a UTC−8 timezone at 5pm local, a task due today (locally) is compared against tomorrow's UTC date and shows green instead of red. Should use local-date formatting (`getFullYear/getMonth/getDate`).

3. **Expired deadlines show red forever** — `status.ts:71` sets `isDeadlineSoon = diffDays <= 7`; for a deadline that passed weeks ago the diff is negative, so the project is permanently flagged. There's no distinction between "deadline soon" and "deadline overdue."

4. **Invoice due date ignores `paymentTerms`** — `invoice.ts:81` hardcodes `+30 days` regardless of the configured terms (e.g., "Net 7" still produces a 30-day due date).

5. **`save -t <hours>` silently no-ops with no active session** — `save.ts:58-63` computes `endTime` only if an active session exists, then `endSession` returns `undefined` and the code prints "No active sessions found." and continues to commit/push. The `-t` flag should at least produce a warning that no session was found to backfill.

6. **`gitCommitInteractive` lacks the unmerged-paths guard** — `git.ts:45-52` stages and commits interactively without the `ls-files -u` check that `gitCommit` has, so a conflicted merge *can* be committed verbatim through `save`/`grind save grind` paths. Also uses `execSync` with `JSON.stringify(path)` embedded in a shell string — breaks if the path contains `"` or `$`.

7. **`prune`/`reject` sweep unrelated changes into commits** — `gitCommit` runs `add -A` on the main worktree. `newProject` fails fast on uncommitted changes, but `rejectIdea` and `pruneIdeas` do not — any pending unrelated edits in `grind/` get committed under "Reject idea:"/"Prune ..." messages.

8. **`journal.ts` calls `openEditorDetached` without `await`** (`journal.ts:24`) — a spawn failure becomes an unhandled rejection that bypasses `index.ts`'s error handler.

### 🟡 Stale documentation (AGENTS.md / README / inline help)

- AGENTS.md claims `session.ts` provides `closeOrphanedSession()` — **it doesn't exist** (only `getActiveSession`/`startSession`/`endSession`).
- AGENTS.md claims `promote` was removed as a "dead source file remains unregistered" — no `promote.ts` exists anymore; the note is stale.
- AGENTS.md claims `resolveProjectConfig()` "checks project worktree then falls back to main worktree" — the implementation (`config.ts:58`) only reads the main-worktree path (which is the *correct* post-refactor behavior, but the doc is wrong). The function is also a near-duplicate of `readProjectConfig` (only differentiator: returns `sourcePath`).
- AGENTS.md documents snapshot testing for list/status — the suite reports **0 snapshots**, so the convention isn't actually in use.
- `index.ts` config help text says `repo` is "GitHub repository (owner/repo format)" — but `validateValue` requires a full git URL via `parseRepoUrl`; "owner/repo" would be rejected. The help is misleading.
- `wwd` has no help description (bare in `--help` output) — AGENTS.md calls it "undocumented," so this may be intentional.

### 🟡 Dead code

- `getCurrentProjectName()` (`workspace.ts:15`) — exported but **zero callers** anywhere in `src/` or `tests/`.

### 🟡 Housekeeping

- **Three lockfiles committed**: `bun.lock`, `package-lock.json`, `pnpm-lock.yaml` — standardize on one (the project uses Bun; `bun.lock` should win).
- **`coverage/` directory is committed to git** (lcov + HTML reports, 30+ files). Should be gitignored (the 96MB `grind` binary is correctly ignored ✅).
- Test runs emit Node `localStorage` experimental warnings — noise, not a failure.

### 🟠 Design risk worth noting

- **Project worktrees carry a stale `projects/{name}/.project.json`** — sessions are written only to the main worktree config, so the copy tracked on each project branch goes stale (it's frozen at worktree-creation state). Publishing merges are currently safe (main's config is a descendant, so git keeps it), but the stale copies are confusing dead weight on every project branch, and any future code that reads the worktree copy could resurrect old data. Worth either removing the config from project branches or documenting the invariant (the `pullWorkspace` comment already notes configs must be read from main — the stale files are the other half of that story).

## Summary

This is a well-structured, genuinely well-tested codebase with strong git-safety instincts and clean error handling. The most impactful issues to fix, in order:

1. The non-existent `grind config -p` flag in docs and error messages (will actively mislead users).
2. The hardcoded `main` assumptions in `getCommitCount`/`pullWorkspace` (breaks the supported custom-`defaultBranch` feature).
3. The UTC-vs-local "due today" mislabeling in the task system.
4. Stale AGENTS.md claims (`closeOrphanedSession`, `promote`, `resolveProjectConfig` behavior).
5. Repo hygiene: coverage artifacts and triple lockfiles in git.
