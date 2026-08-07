# Spec: Docs, Dead Code, Repo Hygiene

Covers **PRD Fixes 10-14** (documentation, dead-code removal, housekeeping). This spec carries both PRD-flagged items as-is: the `wwd` help description (Fix 11) is **included** (it is a real user-facing command; the "intentionally undocumented" stance is reversed).

## Goal

Bring AGENTS.md and CLI help text in line with reality, delete one dead function, and clean repo hygiene:

- **Fix 10:** AGENTS.md claims APIs/behaviors that no longer exist (snapshot-testing convention with 0 snapshots, `resolveProjectConfig` behavior, nonexistent `closeOrphanedSession()`, stale `promote` note).
- **Fix 11:** `index.ts` help text describes `repo` as "GitHub repository (owner/repo format)" but `validateValue` requires a parseable full URL; `wwd` shows bare in `--help`.
- **Fix 12:** `getCurrentProjectName()` (`workspace.ts:15-29`) is exported with **zero callers** — delete it. (The other dead function, `getFirstCommitDate`, is removed in Spec 8.)
- **Fix 13 (docs half):** document the config-on-main invariant — project configs are written only in the main worktree and must always be read from there; the copy on each project branch is frozen and must never be read. (The actual data migration stays out of scope, v2.)
- **Fix 14 (repo hygiene):** standardize on `bun.lock`; untrack the committed `coverage/` artifacts.

## Files to modify

- `AGENTS.md` — four stale-claim fixes + config-on-main invariant
- `src/index.ts` — `repo` help text (line 134); `wwd` description (line 431)
- `src/utils/workspace.ts` — delete `getCurrentProjectName()` + doc comment (lines 10-29)
- `.gitignore` — add `coverage/`
- Repository (git): `git rm package-lock.json pnpm-lock.yaml`; `git rm -r --cached coverage/`

## Changes

### 1. AGENTS.md — stale claims

**a. Convention #5 (line 23)** — the suite has **0 snapshots**; replace the snapshot convention with an honest one:

> 5. **Formatted output assertions**: The suite has **0 snapshots**. For formatted output (table layouts in list/status), assert on the formatted strings / `console.log` output directly (e.g. `expect(line).toContain(RED)`), not Jest snapshots.

**b. `src/utils/config.ts` bullet (line 53)** — the implementation (`config.ts:58`) only reads the main-worktree path, which is the *correct* post-refactor behavior:

> - `src/utils/config.ts` — JSON config file read/write; `resolveProjectConfig()` reads the project config from the main-worktree path and returns `{ config, sourcePath }` (used by `invoice.ts`). Near-duplicate of `readProjectConfig` — kept, do not remove: it has live callers and tests.

**c. `src/utils/session.ts` bullet (line 60)** — `closeOrphanedSession()` doesn't exist:

> - `src/utils/session.ts` — `getActiveSession()`, `startSession()`, `endSession()` for time-tracking session lifecycle

**d. Workflow consolidation (line 72)** — no `promote.ts` exists; remove the trailing sentence:

> **Workflow consolidation:** `grind work <project>` is the unified daily-driver command, supporting `-c` (code editor), `-q` (quiet, no timer), and `-s` (save). `grind edit <project>` and `grind code <project>` are thin aliases calling `workStart()` with appropriate flags. `grind save` accepts `-t <hours>` for time backfill and `-y`/`-q` for auto-commit.

### 2. AGENTS.md — config-on-main invariant (Fix 13 docs half)

Add to the **Configuration hierarchy** section (after the project-level bullet, line 45):

> **Config-on-main invariant:** project configs (`.project.json`) are written **only** in the main worktree and must always be **read from there** (`readProjectConfig`). The `projects/{name}/.project.json` copy on each project branch is frozen at worktree-creation time and must never be read. (`pullWorkspace`'s existing comment — "The config lives in the main worktree (single source of truth)" — states half of this; this doc makes it the contract. The actual migration, stripping frozen configs from project branches, is deferred to v2.)

### 3. `src/index.ts` — help text

**a. `repo` key (line 134):**

> `repo                  git remote URL (e.g. git@github.com:owner/repo.git)`

(`validateValue` → `parseRepoUrl` rejects bare "owner/repo"; the old help is misleading.)

**b. `wwd` command (lines 431-434)** — add a description (flagged in the PRD; carried as-is):

```typescript
// grind wwd (status + tasks dashboard)
program
  .command("wwd")
  .description("What we doing? — status + tasks dashboard")
  .action(async () => {
    await wwd();
  });
```

### 4. `src/utils/workspace.ts` — delete `getCurrentProjectName()`

Remove the function and its doc comment (lines 10-29). The remaining imports (`path`, `fileExists`, `GrindUserError`, path helpers) are all still used by `findBareRepo`/`getWorkspaceRoot`/`findMainWorktree`/`requireWorkspace` — no import cleanup needed.

### 5. Repo hygiene (Fix 14)

`.gitignore` — add after the `dist/` block (line 9):

```gitignore
# Test coverage output
coverage/
```

Then, from the repo root (untrack the committed artifacts; keep files on disk):

```bash
git rm package-lock.json pnpm-lock.yaml
git rm -r --cached coverage/
```

No other file changes. (`package-lock.json`/`pnpm-lock.yaml` deletions apply to the currently-committed files only; no migration is imposed on other toolchains.)

## Tests

No new unit tests — the only code change is a deletion (`getCurrentProjectName` has no test references; `bun run test` must stay green after removal). The rest is docs/git-index changes.

Verification of the full batch instead:

```bash
bun run typecheck        # no references to getCurrentProjectName remain
bun run test             # full suite green
bun run build            # binary still compiles
grep -rn "getCurrentProjectName" src/ tests/   # no matches
git status               # shows staged deletions: package-lock.json, pnpm-lock.yaml, coverage/ files
./grind config --help    # repo key shows "git remote URL ..."; wwd has its description in --help
```

## Dependencies

- Spec 7 (independent; both touch `src/index.ts` — Spec 7 edits the config command registration ~lines 115-182, this spec edits the help-text block ~line 134 and the `wwd` command ~line 431. Different regions; sequential implementation is trivially conflict-free)
- Spec 8 (independent; `getFirstCommitDate` removal there + `getCurrentProjectName` removal here are separate functions)
- Spec 12 is the recommended **last** spec in the batch, per the PRD's priority order (so the `coverage/` removal can't obscure other diffs).

## Verification

```bash
bun run typecheck
bun run test
bun run build
git status   # confirm the intended staged deletions only
```
