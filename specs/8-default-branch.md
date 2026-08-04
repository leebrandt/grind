# Spec: Respect Custom Default Branch

Covers **PRD Fix 2** (plus the `getFirstCommitDate` dead-code removal that Fix 2 bundles).

## Goal

Make all branch handling respect the configured/detected default branch. Today `getCommitCount` hardcodes `--not main` and `pullWorkspace` hardcodes `merge origin/main` and filters project branches with `b !== "main"` — a workspace with `GrindConfig.defaultBranch ≠ main` (or a bare repo whose HEAD points at a non-`main` branch) gets wrong commit counts and a wrong pull merge. `getFirstCommitDate` has the same hardcode but **zero callers** (its only consumer, the "Started" status column, was removed) — it is deleted rather than fixed.

## Files to modify

- `src/utils/git.ts` — `getCommitCount` defaultBranch param; delete `getFirstCommitDate`; `pullWorkspace` resolves + uses default branch
- `src/commands/status.ts` — resolve default branch, pass it to `getCommitCount`
- `tests/utils/git.test.ts` — remove `getFirstCommitDate` block; add `getCommitCount` + custom-branch `pullWorkspace` tests
- `tests/commands/status.test.ts` — add `getDefaultBranch` to the git mock

## Changes

### 1. `getCommitCount` — add a defaultBranch parameter (`git.ts:126-133`)

```typescript
export async function getCommitCount(
  repoPath: string,
  branch: string,
  defaultBranch: string = "main",
): Promise<number> {
  try {
    const result = await $`git -C ${repoPath} rev-list --count ${branch} --not ${defaultBranch}`.quiet();
    return parseInt(result.stdout.toString().trim(), 10);
  } catch {
    return 0;
  }
}
```

The `= "main"` default keeps any un-updated callers compiling.

### 2. Delete `getFirstCommitDate` entirely (`git.ts:135-146`)

Remove the function and its doc comment. It has zero callers in `src/` or `tests/`. (The review's "fix the hardcode" wording is superseded by removal — fixing a dead function is pointless.)

### 3. `pullWorkspace` — resolve the default branch once and use it (`git.ts:461`)

At the top of the function body, before step 1:

```typescript
const defaultBranch = await getDefaultBranch(bareRepoPath);
```

(The config param of `getDefaultBranch` is optional — bare-repo `symbolic-ref HEAD` detection covers the custom-branch case.)

- **Step 3** (line 511): `merge origin/${defaultBranch}` instead of `merge origin/main`:
  ```typescript
  await $`git -C ${mainWorktreePath} merge origin/${defaultBranch} --no-edit`.quiet();
  ```
- **Step 4** (line 521): exclude the resolved default branch instead of `"main"`:
  ```typescript
  .filter(b => b !== defaultBranch && b !== "HEAD");
  ```

### 4. `src/commands/status.ts` — pass the resolved default branch

Update the import (line 6):

```typescript
import { getCommitCount, getDefaultBranch, getLastCommitDate } from "../utils/git.js";
```

Resolve the branch once before the per-project `Promise.all` (single git call instead of N):

```typescript
export async function status(): Promise<void> {
  const { workspaceRoot, bareRepo } = await requireWorkspace();
  const defaultBranch = await getDefaultBranch(bareRepo);
  ...
  const [commitCount, lastCommitDate, openTasks] = await Promise.all([
    getCommitCount(bareRepo, branch, defaultBranch),
    getLastCommitDate(bareRepo, branch),
    getOpenTasks(workspaceRoot, name),
  ]);
```

## Tests

### `tests/utils/git.test.ts`

1. **Remove** the `getFirstCommitDate` describe block (lines 105-147) and drop `getFirstCommitDate` from the import on line 6. Add `getCommitCount` to that import.

2. Add a `describe("getCommitCount")` block (uses the existing `shellMock` helper, asserting on reconstructed commands):

   - default branch `"main"` → the `rev-list` call contains `--not main`
   - default branch `"develop"` → the `rev-list` call contains `--not develop` (assert on `cmdOf`, and the returned count)

3. Add a `pullWorkspace` test for a custom default branch:

   ```typescript
   it("uses the custom default branch for the merge and project filtering", async () => {
     shellMock({
       "symbolic-ref HEAD": { stdout: "refs/heads/develop\n" },
       "fetch --all": { stdout: "" },
       "branch -r --format": { stdout: "origin/develop\norigin/proj\n" },
       "branch --format": { stdout: "develop\n" },
       "rev-parse --verify origin/": { stdout: "abc123", exitCode: 0 },
       "rev-parse --verify refs/heads/": { stdout: "abc123", exitCode: 0 },
       "merge origin/develop": { stdout: "" },
       "worktree list --porcelain": { stdout: "worktree /home/user/work/grind\n" },
     });
     (fs.stat as jest.Mock).mockRejectedValue(new Error("ENOENT"));
     (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ name: "proj", time: [] }));

     const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

     const calls = mock$.mock.calls.map(c => cmdOf(c));
     expect(calls.some(c => c.includes("merge origin/develop"))).toBe(true);
     expect(calls.some(c => c.includes("merge origin/main"))).toBe(false);
     // develop is the default branch, not a project — only "proj" is created
     expect(result.created).toBe(1);
   });
   ```

   The existing `pullWorkspace` tests keep passing unchanged: unmatched `"symbolic-ref HEAD"` routes return empty stdout, so `getDefaultBranch` falls through to `"main"`.

### `tests/commands/status.test.ts`

The git mock (lines 22-25) must add `getDefaultBranch` or the first `await getDefaultBranch(bareRepo)` in `status()` rejects:

```typescript
jest.mock("../../src/utils/git.js", () => ({
  getCommitCount: jest.fn().mockResolvedValue(5),
  getDefaultBranch: jest.fn().mockResolvedValue("main"),
  getLastCommitDate: jest.fn().mockResolvedValue("2026-07-10T12:00:00Z"),
}));
```

## Dependencies

- Spec 7 (independent; no ordering constraint)
- Do **not** run in parallel with Spec 11 — both edit `src/utils/git.ts` (different functions, but same file).

## Verification

```bash
bun run typecheck
bun run test -- tests/utils/git.test.ts tests/commands/status.test.ts

# Manual smoke test:
# On a workspace with defaultBranch=develop configured:
grind pull                # merges origin/develop, does not treat develop as a project
grind status              # commit-count-based columns unchanged for main-based workspaces
```
