# PRD: Grind Hardening — Code Review 2026-08-03 Remediation

## Overview

Remediate every actionable finding from `docs/code-review-08032026.md`: one user-facing bug (nonexistent `grind config -p` flag), eight correctness bugs, five stale documentation claims, one dead-code removal, and three housekeeping items. Also documented is the one deferred architectural risk (stale `.project.json` copies on project branches), which is explicitly out of scope for this pass.

This is a hardening PRD, not a feature PRD: no user-facing behavior is added beyond the `-p` flag alias; every other change fixes wrong behavior, wrong docs, or repo hygiene.

## Motivation

The review found a well-structured codebase with a handful of genuine defects, most impactful first:

1. `grind config -p <project>` is referenced in README + two error messages but **does not exist** — users following instructions get `error: unknown option '-p'`.
2. The supported `defaultBranch` config feature is broken in three places that hardcode `main` (commit counts, first-commit date, `pull` merge) — workspaces using a custom default branch get wrong numbers and wrong pulls.
3. Task "due today" is computed in UTC — mislabels due-today tasks in negative-UTC-offset timezones.
4. Expired project deadlines are flagged red forever with no "overdue" vs "soon" distinction.
5. Invoices hardcode a 30-day due date regardless of configured `paymentTerms`.
6. `save -t <hours>` silently ignores the flag when no session is active.
7. Interactive commits lack the unmerged-paths guard (conflicted merges can be committed verbatim) and build shell strings with `JSON.stringify` (path-injection risk).
8. `reject`/`prune` run `git add -A`, sweeping unrelated WIP into "Reject idea:"/"Prune" commits.
9. `journal` spawns the editor without `await`/error handling — a spawn failure bypasses `index.ts`'s error handler.
10. AGENTS.md describes APIs/behaviors that no longer exist; `index.ts` help text for `repo` is misleading.

None of these require design changes; all are surgical fixes with tests.

## Goals

- Fix the `-p` flag so every documented `grind config` invocation works.
- Make all branch handling respect the configured/detected default branch.
- Make all "today"/date-string computations timezone-correct (local, not UTC).
- Distinguish overdue deadlines from upcoming ones in `grind status`.
- Honor `paymentTerms` in invoice due dates.
- Make `save -t` warn when it can't backfill.
- Close the three git-safety gaps: interactive commit guard, shell-string path injection, and `add -A` sweeping in `reject`/`prune`/`invoice`.
- Make the detached editor failure path reach the central error handler.
- Bring AGENTS.md / help text in line with reality; delete dead code; clean repo hygiene.
- Add or update tests for every code change (existing conventions: pure functions get pure tests; git/fs mocked at the bun-shell/fs level only).

## Out of Scope (v1)

- **Stale `.project.json` on project branches (design risk):** removing the frozen config copies from every project branch requires a data migration across existing workspaces. Deferred to v2. This PRD only documents the invariant (see Fix 13).
- **Node `localStorage` experimental warnings in test output:** accepted noise, not a failure. No change.
- **Non-atomic config write in `invoice.ts:186`** (`writeFile` instead of the `atomicWrite` helper): noted, out of scope to keep this pass review-scoped.
- Deleting `package-lock.json`/`pnpm-lock.yaml` **recreations**: only the currently-committed files are removed; no future migration is imposed on other toolchains.

---

## P0 — User-facing bug

### Fix 1: Add `-p, --project` alias to `grind config`

**Problem.** `src/index.ts` registers `config [project] [key] [value]` with only `-g`/`-l` flags. Three places tell users to use `-p`:
- `README.md:130-132` — `grind config -p my-project repo git@github.com:owner/repo.git` (and `code`, `longTerm`)
- `src/commands/work.ts:43` — error message `grind config -p ${projectName} code <directory>`
- `src/commands/new.ts:209` — error message `grind config -p ${projectName} repo ...`

Following any of these fails with Commander's `error: unknown option '-p'`.

**Decision (confirmed in interview):** add the flag as an alias rather than fixing the three references. All existing docs and error messages become valid, and the flag reads better than the positional form.

**Changes.**
- `src/index.ts` (config command registration, ~line 115): add `.option("-p, --project <name>", "Project name (alternative to positional [project])")`.
- `src/commands/config.ts`: add and export a small pure helper:
  ```typescript
  export function resolveProjectArg(
    positional: string | undefined,
    flag: string | undefined,
    isGlobal: boolean,
  ): string | undefined
  ```
  - If `isGlobal` and `flag` both set → throw `GrindUserError("Cannot use -p/--project with -g/--global")`.
  - If both `positional` and `flag` set and they differ → throw `GrindUserError` listing both forms.
  - Otherwise return `flag ?? positional`.
  - Extract the logic into `config.ts` (not inline in `index.ts`) so it is unit-testable per the "test the utility logic, not the glue" convention.
- `src/index.ts` action handler: call `resolveProjectArg(project, options.project, options.global)` and use the result in the non-global branch (lines 169-180). The existing `"Project name is required"` error (line 171) now applies to the resolved value.
- Update the usage comment in `src/commands/config.ts:6-13` to document `-p`.
- **No change** to README lines 130-132 or the error messages in `work.ts`/`new.ts` — they become correct once the flag exists.

**Tests** (`tests/commands/config.test.ts`):
- `resolveProjectArg` with only positional → returns positional.
- Only `-p` → returns flag.
- Both, same value → returns value.
- Both, different → throws `GrindUserError` (assert message + exit code 1).
- `-p` with `-g` → throws.
- No project, not global → returns `undefined` (index.ts raises "Project name is required").

---

## P1 — Correctness bugs

### Fix 2: Custom `defaultBranch` respected in commit counts and `pull`

**Problem.** `getCommitCount` (`git.ts:128`) and `getFirstCommitDate` (`git.ts:140`) hardcode `--not main`; `pullWorkspace` (`git.ts:511`) hardcodes `merge origin/main` and filters project branches with `b !== "main"` (`git.ts:521`). A workspace with `GrindConfig.defaultBranch ≠ main` gets wrong commit counts and a wrong pull merge.

**Changes.**
- `src/utils/git.ts`:
  - `getCommitCount(repoPath, branch, defaultBranch = "main")` — use `--not ${defaultBranch}`.
  - **Delete `getFirstCommitDate()` entirely** — it has zero callers (its only consumer, the "Started" status column, was removed). Fixing the hardcode in a dead function is pointless; the review's stated fix is superseded by removal.
  - `pullWorkspace(bareRepoPath, mainWorktreePath, workspaceRoot)`: resolve once at the top via `const defaultBranch = await getDefaultBranch(bareRepoPath);` (config param is optional — bare-repo `symbolic-ref HEAD` detection covers it). Use it for the step-3 merge (`merge origin/${defaultBranch}`) and the step-4 filter (`b !== defaultBranch`).
- `src/commands/status.ts:45`: resolve `const defaultBranch = await getDefaultBranch(bareRepo);` and call `getCommitCount(bareRepo, branch, defaultBranch)`.

**Tests** (`tests/utils/git.test.ts`):
- `getCommitCount` with default branch `main` issues `--not main`; with `develop` issues `--not develop` (assert on the mocked bun shell command args).
- `pullWorkspace` with default branch `develop` issues `merge origin/develop` and does not treat `develop` as a project branch (mock `$` to return a `symbolic-ref` HEAD of `refs/heads/develop`).

### Fix 3: "Due today" / date strings use local time, not UTC

**Problem.** `getTaskUrgency` (`task.ts:74`), `getDueColor` (`tasks.ts:40`), and the journal filename (`journal.ts:21`) all derive "today" via `new Date().toISOString().slice(0, 10)` — UTC. In UTC−8 at 5pm local, a task due today compares against tomorrow's UTC date and shows green instead of red; `grind journal` creates tomorrow's entry.

**Changes.**
- `src/utils/time.ts`: add pure helper:
  ```typescript
  export function toLocalDateString(d: Date = new Date()): string // YYYY-MM-DD via getFullYear/getMonth/getDate
  ```
- `src/utils/task.ts:74` — `getTaskUrgency` uses `toLocalDateString(today)`.
- `src/commands/tasks.ts:40` — `getDueColor` uses `toLocalDateString(now)`.
- `src/commands/journal.ts:21` — filename uses `toLocalDateString()`.
- No change to the `diff <= 3` "soon" computation: both operands are date-only strings parsed identically, so day diffs stay exact.

**Tests**:
- `tests/utils/time.test.ts` — `toLocalDateString` for a fixed date, incl. month/day zero-padding and month boundary crossing (e.g. Jan 1 local vs UTC-adjacent).
- `tests/utils/task.test.ts` — `getTaskUrgency` with injected `now` at a UTC-offset edge (e.g. `2026-08-03T00:30:00-08:00` → local date 2026-08-02 → task due `2026-08-02` is "today", not "soon").
- `tests/commands/tasks.test.ts` — `getDueColor` with injected `now` at the same edge; a due-today task renders RED.

### Fix 4: Distinguish overdue deadlines from upcoming ones in `status`

**Problem.** `status.ts:71` sets `isDeadlineSoon = diffDays <= 7`; a deadline passed weeks ago has a negative diff and is flagged red forever.

**Decision (confirmed):** three states — **overdue** (diff < 0) → RED; **soon** (0 ≤ diff ≤ 7) → YELLOW; else no deadline color. Note this changes "soon" projects from RED to YELLOW.

**Changes.**
- `src/commands/status.ts`:
  - `ProjectRow`: add `isDeadlineOverdue: boolean`; keep `isDeadlineSoon`.
  - Deadline block (lines 65-72): `isDeadlineOverdue = diffDays < 0`; `isDeadlineSoon = diffDays >= 0 && diffDays <= 7`.
  - Name-color priority (lines 113-122): `isActive` (GREEN) > `isDeadlineOverdue` (RED) > `isDeadlineSoon` (YELLOW) > `hasUnbilled` (YELLOW) > WHITE.

**Tests** (`tests/commands/status.test.ts`): a project with a deadline 2 days ago renders RED and is overdue; a deadline in 3 days renders YELLOW; a deadline in 10 days renders no deadline color; an active project stays GREEN even when overdue.

### Fix 5: Invoice due date honors `paymentTerms`

**Problem.** `invoice.ts:81` hardcodes `+30 days` regardless of configured terms ("Net 7" still yields a 30-day due date). The `dueDate` is computed once and passed into both the markdown and the PDF (`generateInvoicePDFBuffer`), so one fix covers both paths.

**Changes.**
- `src/commands/invoice.ts`: export a pure helper:
  ```typescript
  export function daysFromPaymentTerms(terms: string): number
  ```
  - `/^net\s+(\d+)$/i` → that number (e.g. "Net 7" → 7, "net 30" → 30)
  - contains "due on receipt" (case-insensitive) → 0
  - anything else → 30 (unchanged fallback)
- Replace line 81: `const dueDate = formatDate(new Date(now.getTime() + daysFromPaymentTerms(paymentTerms) * 24 * 60 * 60 * 1000).toISOString());`

**Tests**: `tests/commands/invoice.test.ts` (new) — `daysFromPaymentTerms("Net 30") → 30`, `("Net 7") → 7`, `("net 15") → 15`, `("Due on receipt") → 0`, `("weird") → 30`, `("") → 30`.

### Fix 6: `save -t` warns when no session exists to backfill

**Problem.** `save.ts:52-63` only computes `endTime` when an active session exists; otherwise `endSession` returns `undefined`, the code prints "No active sessions found." and proceeds to commit/push — the `-t` request is silently dropped.

**Decision (confirmed):** warn and continue (non-fatal); do not block save/commit/push.

**Changes.**
- `src/commands/save.ts`: in the `else` branch (no `endedSession`), when `options?.time` was provided, print a distinct warning before the existing line:
  `Warning: -t <hours> ignored — no active session found to backfill for '<project>'.`

**Tests** (`tests/commands/save.test.ts`): with `-t` and no active session → output contains the warning and the command still proceeds to commit/push (mock git).

### Fix 7: `gitCommitInteractive` — unmerged guard + no shell-string paths

**Problem.** `git.ts:45-52`: stages with `add -A` and commits without the `ls-files -u` guard that `gitCommit` has (a conflicted merge *can* be committed verbatim via `save`/`grind save grind`). It also embeds `JSON.stringify(worktreePath)` in an `execSync` shell string — breaks if the path contains `"` or `$`.

**Changes.**
- `src/utils/git.ts` `gitCommitInteractive(worktreePath)`:
  - After `add -A`, run the same `ls-files -u` check as `gitCommit` and throw `GrindSystemError` with the same message if unmerged paths exist.
  - Replace `execSync(\`git -C ${JSON.stringify(worktreePath)} commit\`)` with `execFileSync("git", ["-C", worktreePath, "commit"], { stdio: "inherit" })` (import from `node:child_process`). No shell → no quoting/injection. `execFileSync` keeps `stdio: "inherit"` TTY forwarding for interactive editors.

**Tests** (`tests/utils/git.test.ts`): mocked `$` returns unmerged paths → `gitCommitInteractive` throws `GrindSystemError` and does not reach the commit call. (The `execFileSync` spawn itself is left to manual verification — spawning a real git in tests is out of convention.)

### Fix 8: `reject`/`prune` (and `invoice`) stop sweeping unrelated changes

**Problem.** `gitCommit` always runs `add -A`; `rejectIdea` (`reject.ts:51`) and `pruneIdeas` (`prune.ts:52`) call it, so any pending WIP in `grind/` is swept into "Reject idea:"/"Prune" commits. (`newProject` already fails fast on uncommitted changes — unchanged.)

**Decision (confirmed):** surgical staging — commit only the specific idea file(s), no fail-fast.

**Changes.**
- `src/utils/git.ts` `gitCommit(worktreePath, message, paths?: string[])`: when `paths` is provided, stage with `git add ${paths}` (Bun `$` spreads arrays into separate args) instead of `add -A`. The unmerged-paths guard runs in both branches (after staging, as today).
- `src/commands/reject.ts:51`: `gitCommit(mainWorktree, \`Reject idea: ${title}\`, [oldPath, newPath])`.
- `src/commands/prune.ts:52`: `gitCommit(mainWorktree, \`Prune ${n} rejected idea(s)\`, rejectedFiles.map(f => path.join(ideasDir, f)))`.
- **Bonus (same bug class, flagged for confirmation):** `src/commands/invoice.ts:189` — `gitCommit(mainWorktree, \`Invoice ${timestamp} for ${projectName}\`, [invoiceDir, configPath])`. The review did not list this one, but it is the identical `add -A` sweep pattern, and the two affected paths are exactly known (invoice output dir + updated `.project.json`).

**Tests**:
- `tests/utils/git.test.ts` — `gitCommit` with `paths` stages exactly those paths (assert `add` args) and still guards unmerged paths.
- `tests/commands/prune.test.ts` — prune with unrelated WIP present commits only the rejected-idea files.

### Fix 9: `journal` awaits the detached editor; spawn errors are handled

**Problem.** `journal.ts:24` calls `openEditorDetached` without `await`, and `editor.ts:24-32` registers only a `close` handler — a spawn failure (`ENOENT` editor) emits an unhandled `error` event that crashes the process and bypasses `index.ts`'s error handler.

**Changes.**
- `src/utils/editor.ts` `openEditorDetached(filePath)`:
  - Wrap the spawn in a `Promise` that rejects on the child's `error` event (with a `GrindSystemError` wrapping the spawn error) and resolves on `close`.
  - Remove the misleading `async` keyword (no awaits remain inside) — it becomes a normal `Promise<void>`-returning function.
- `src/commands/journal.ts:24`: `await openEditorDetached(filePath);` (now genuinely async; errors flow to the central handler). `work.ts:70` already awaits it — no change there.

**Tests** (`tests/utils/editor.test.ts`): with `EDITOR` set to a nonexistent binary, `openEditorDetached` rejects with `GrindSystemError` (message asserts exit code 2). With a valid binary (e.g. `true` or `echo`), it resolves.

---

## P2 — Documentation fixes

### Fix 10: AGENTS.md stale claims

| AGENTS.md location | Claim | Fix |
|---|---|---|
| Line 23 (convention #5) | "Snapshot testing ... use Jest snapshots" | Reword: the suite has **0 snapshots**; replace with an honest convention — assert on formatted table strings / `console.log` output. |
| Line 53 | `resolveProjectConfig()` "checks project worktree then falls back to main worktree" | Correct to: reads the config from the main-worktree path and returns `{ config, sourcePath }`; used by `invoice.ts`. (It is a near-duplicate of `readProjectConfig` — note this, do not remove: it has a live caller and tests.) |
| Line 60 | `session.ts` provides `closeOrphanedSession()` | Remove the nonexistent function from the list (only `getActiveSession`/`startSession`/`endSession` exist). |
| Line 72 | "`grind promote` is removed (dead source file remains unregistered)" | Remove the sentence — no `promote.ts` exists. |
| Add | — | Document the config-on-main invariant (see Fix 13). |

### Fix 11: `index.ts` help text

- Line 134: `repo  GitHub repository (owner/repo format)` → `repo  git remote URL (e.g. git@github.com:owner/repo.git)` — `validateValue` requires a parseable full URL; "owner/repo" is rejected.
- `wwd` command (line 431): add `.description("What we doing? — status + tasks dashboard")`. **Flagged:** AGENTS.md currently notes `wwd` is intentionally undocumented; recommendation is to describe it since it is a real user-facing command. Strike this if you want to keep it hidden.

---

## P3 — Dead code

### Fix 12: Remove `getCurrentProjectName()`

**Problem.** `src/utils/workspace.ts:15-29` — exported, zero callers in `src/` or `tests/` (also shows 0 executions in coverage).

**Changes.** Delete the function and its doc comment from `workspace.ts`. (Also covered here: `getFirstCommitDate` removal in Fix 2.)

**Tests.** No test references it today; ensure `bun run test` stays green after removal.

---

## P4 — Housekeeping

### Fix 13 (docs) + Fix 14 (repo hygiene)

- **Repo hygiene:**
  - `git rm package-lock.json pnpm-lock.yaml` — standardize on `bun.lock` (project uses Bun). No other file changes.
  - Add `coverage/` to `.gitignore` (after `dist/`), then `git rm -r --cached coverage/` — removes 30+ committed lcov/HTML artifacts (which are provably stale: they reference a `closeOrphanedSession` that no longer exists).
- **Documentation (deferred-architecture half of the review's design-risk item):**
  - AGENTS.md (in the Architecture / config section): document the invariant — *project configs are written only in the main worktree and must always be read from there; the `projects/{name}/.project.json` copy on each project branch is frozen at worktree-creation and must never be read.* `pullWorkspace`'s existing comment already states half of this; the doc makes it the contract.
  - The actual migration (stripping configs from project branches) stays out of scope (v2).

---

## Priority order (implementation sequence)

Mirrors the review's own ordering — each step leaves the tree green (`bun run typecheck` + `bun run test`):

1. **Fix 1** (`-p` flag) — unblocks misled users immediately; small, isolated.
2. **Fix 2** (defaultBranch) — supported-feature correctness; touches `git.ts` core.
3. **Fix 3** (local dates) — pure helper + 3 call sites; easy test win.
4. **Fixes 4-6** (deadline states, paymentTerms, `save -t`) — three independent command-level fixes.
5. **Fixes 7-9** (git safety + journal await) — grouped as the "git-safety" batch.
6. **Fixes 10-12** (docs + dead code).
7. **Fix 13/14** (housekeeping) — last, so the `coverage/` removal can't obscure diffs.

## Verification

```bash
bun run typecheck        # tsc --noEmit clean
bun run test             # 225 existing tests + new/updated tests, all passing
bun run build            # single-binary build still compiles

# Manual smoke tests:
grind config -p my-project repo git@github.com:owner/repo.git   # previously errored
grind config my-project repo git@github.com:owner/repo.git      # positional still works
grind config -p x -g billing.roundTo quarter-hour               # → error: -p with -g
grind status              # deadline 2 days ago → red; in 3 days → yellow; 10 days → plain
grind tasks               # due-today task shows red at local timezone edge
grind invoice <project>   # Net 7 config → 7-day due date in markdown AND pdf
grind save <project> -t 1 # no active session → warning printed, commit/push proceeds
grind journal             # editor opens today's file (local date); invalid EDITOR → clean GrindSystemError
grind reject idea 1       # with unrelated WIP present → WIP stays uncommitted
grind prune ideas -y      # same
grind pull                # on a workspace with defaultBranch=develop → merges origin/develop
```

## Risks / Notes

- **Fix 4 changes visible color behavior** for "deadline within 7 days" projects (RED → YELLOW). Confirmed acceptable in interview.
- **Fix 8 bonus item** (`invoice` sweep) is the only change beyond the review's letter; flagged for explicit confirmation.
- **Fix 11 `wwd` description** reverses the "intentionally undocumented" stance; flagged for explicit confirmation.
- Fix 2's `getFirstCommitDate` removal is a deviation from the review's "fix the hardcode" wording, justified by the function being dead.
