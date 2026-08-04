# Spec: Git Safety + Journal/Editor

Covers **PRD Fixes 7-9** (the "git-safety" batch), including the Fix 8 **bonus item** (invoice sweep) — confirmed to carry as-is.

## Goal

Close three git-safety gaps and fix the detached-editor failure path:

1. **Fix 7 — `gitCommitInteractive`:** add the unmerged-paths guard that `gitCommit` has (a conflicted merge can today be committed verbatim via `save` / `grind save grind`), and stop building shell strings with `JSON.stringify` (path-injection risk) by switching to `execFileSync`.
2. **Fix 8 — surgical staging:** `gitCommit` always runs `add -A`, so `rejectIdea`/`pruneIdeas` sweep any unrelated WIP in `grind/` into "Reject idea:"/"Prune" commits. Commit only the specific files. **Bonus (same bug class):** `invoice.ts:189` also uses `gitCommit` with `add -A`; the two affected paths are exactly known (invoice output dir + updated `.project.json`).
3. **Fix 9 — journal/editor:** `journal.ts:24` calls `openEditorDetached` without `await`, and `editor.ts:24-32` only registers a `close` handler — a spawn failure (`ENOENT` editor) emits an unhandled `error` event that crashes the process and bypasses `index.ts`'s error handler.

## Files to modify

- `src/utils/git.ts` — `gitCommitInteractive` guard + `execFileSync`; `gitCommit` `paths` param
- `src/commands/reject.ts` — line 51: pass the two renamed paths
- `src/commands/prune.ts` — line 52: pass the deleted idea paths
- `src/commands/invoice.ts` — line 189 (bonus): pass `[invoiceDir, configPath]`
- `src/utils/editor.ts` — `openEditorDetached` returns a rejecting/resolving Promise
- `src/commands/journal.ts` — line 24: `await openEditorDetached(filePath)`
- Tests: `tests/utils/git.test.ts`, `tests/commands/prune.test.ts`, `tests/utils/editor.test.ts`

## Changes

### 1. `src/utils/git.ts` — import swap (line 5)

```typescript
import { execFileSync } from "node:child_process";
```

(`execSync` was only used by `gitCommitInteractive`.)

### 2. `gitCommitInteractive` (lines 45-52)

```typescript
export async function gitCommitInteractive(worktreePath: string): Promise<void> {
  await $`git -C ${worktreePath} add -A`.quiet();

  const unmerged = await $`git -C ${worktreePath} ls-files -u`.quiet().nothrow();
  if (unmerged.stdout.toString().trim().length > 0) {
    throw new GrindSystemError(
      "Refusing to commit: there are unmerged paths in this worktree.\n" +
      "Resolve the conflicts first (git status), then retry.",
    );
  }

  // No shell → no quoting/injection. stdio "inherit" keeps the TTY for interactive editors.
  execFileSync("git", ["-C", worktreePath, "commit"], { stdio: "inherit" });
}
```

`execFileSync` spawns git directly (no `sh -c`), so a worktree path containing `"` or `$` is safe.

### 3. `gitCommit` — optional `paths` param (lines 27-39)

```typescript
export async function gitCommit(worktreePath: string, message: string, paths?: string[]): Promise<void> {
  if (paths) {
    await $`git -C ${worktreePath} add ${paths}`.quiet(); // Bun $ spreads arrays into separate args
  } else {
    await $`git -C ${worktreePath} add -A`.quiet();
  }

  const unmerged = await $`git -C ${worktreePath} ls-files -u`.quiet().nothrow();
  if (unmerged.stdout.toString().trim().length > 0) {
    throw new GrindSystemError(
      "Refusing to commit: there are unmerged paths in this worktree.\n" +
      "Resolve the conflicts first (git status), then retry.",
    );
  }

  await $`git -C ${worktreePath} commit -m ${message}`.quiet();
}
```

The unmerged-paths guard runs in **both** branches (after staging, as today). Backward compatible — existing callers without `paths` are unchanged.

### 4. Call sites

- `src/commands/reject.ts:51`:
  ```typescript
  await gitCommit(mainWorktree, `Reject idea: ${title}`, [oldPath, newPath]);
  ```
- `src/commands/prune.ts:52`:
  ```typescript
  await gitCommit(
    mainWorktree,
    `Prune ${rejectedFiles.length} rejected idea(s)`,
    rejectedFiles.map(f => path.join(ideasDir, f)),
  );
  ```
- `src/commands/invoice.ts:189` (bonus — confirmed to carry):
  ```typescript
  await gitCommit(mainWorktree, `Invoice ${timestamp} for ${projectName}`, [invoiceDir, configPath]);
  ```
  `invoiceDir` and `configPath` are the two paths this command actually writes (`configPath` is the resolved main-worktree config path from `resolveProjectConfig`).

### 5. `src/utils/editor.ts` — `openEditorDetached` (lines 24-32)

Replace with a Promise-returning function (drop the misleading `async` keyword — no awaits remain):

```typescript
export function openEditorDetached(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const editor = spawn(editorBinary, [filePath], { stdio: "inherit" });

    editor.on("error", (err) => {
      reject(
        new GrindSystemError(
          `Failed to launch editor "${editorBinary}"`,
          err instanceof Error ? err : undefined,
        ),
      );
    });

    editor.on("close", (code) => {
      if (code !== 0) {
        console.error(`Editor exited with code ${code}`);
      }
      resolve();
    });
  });
}
```

Behavior notes:
- Rejects on spawn `error` (e.g. `ENOENT`) with a `GrindSystemError` (exit code 2) wrapping the spawn error — the failure now reaches the central handler in `index.ts`.
- Resolves on `close` (non-zero exit still only logs to `console.error`, matching today's behavior).
- If both `error` and `close` fire, the promise is already settled — the later `resolve()` is a no-op.
- `openEditor` and `editTempFile` are unchanged.

### 6. `src/commands/journal.ts:24`

```typescript
await openEditorDetached(filePath);
```

(`work.ts:70` already awaits it — no change there.)

## Tests

### `tests/utils/git.test.ts`

Add to the existing `gitCommit` describe (using the existing `shellMock`/`cmdOf` helpers):

- **`gitCommit` with `paths` stages exactly those paths**: mock `"ls-files -u"` → empty; call `gitCommit("/fake/worktree", "msg", ["/fake/worktree/a.md", "/fake/worktree/b.md"])`; assert the `add` call's interpolated value equals the array and no `add -A` was issued:
  ```typescript
  const addCall = mock$.mock.calls.find(c => cmdOf(c).includes(" add "));
  expect(addCall![1]).toEqual(["/fake/worktree/a.md", "/fake/worktree/b.md"]);
  expect(cmdOf(addCall!)).not.toContain("-A");
  ```
- **`gitCommit` with `paths` still guards unmerged paths**: mock `"ls-files -u"` → unmerged output → rejects with `"unmerged"`, no `commit -m` issued.
- **`gitCommitInteractive` refuses unmerged paths**: mock `"add -A"` → ok, `"ls-files -u"` → unmerged output → `rejects.toThrow("unmerged")`. (The `execFileSync` spawn itself is left to manual verification — spawning real git in tests is out of convention.)

### `tests/commands/prune.test.ts`

The git mock (lines 9-11) is currently an inline `gitCommit: jest.fn().mockResolvedValue(undefined)` — hoist it to a named mock (`mockGitCommit`) so call args are assertable. Add:

- **prune with unrelated WIP present commits only the rejected-idea files**: `readdir` returns `["rejected-a.md", "rejected-b.md", "unrelated.md"]`; `confirmOrExit` resolves; assert
  ```typescript
  expect(mockGitCommit).toHaveBeenCalledWith(
    expect.any(String),
    "Prune 2 rejected idea(s)",
    expect.arrayContaining([
      expect.stringContaining("rejected-a.md"),
      expect.stringContaining("rejected-b.md"),
    ]),
  );
  ```
  and the third argument does **not** include "unrelated.md".

### `tests/utils/editor.test.ts`

Rewrite the `openEditorDetached` describe (lines 57-77). The old `spawnMock.mockReturnValue({ on: jest.fn() })` would hang the new Promise (no `close`/`error` ever fires). Use a real `EventEmitter` from `node:events` as the mocked child:

- **spawns the editor with the file path**: `spawnMock` returns an emitter; call `openEditorDetached("/path/to/file.md")`; assert `spawnMock` called with `("nvim", ["/path/to/file.md"], { stdio: "inherit" })`; then emit `close` so the promise settles and the test exits cleanly.
- **resolves when the editor exits**: `child.emit("close", 0)` → `await expect(p).resolves.toBeUndefined()`.
- **logs on non-zero exit**: `child.emit("close", 1)` → `console.error` called with `"Editor exited with code 1"`, promise resolves.
- **rejects with GrindSystemError on spawn failure**: `child.emit("error", new Error("ENOENT"))` → `await expect(p).rejects.toThrow("Failed to launch editor")`; assert the caught error is a `GrindSystemError` with `exitCode === 2` (per convention: no `process.exit`, assert on message + exit code).

## Dependencies

- Specs 7-10 (independent; no ordering constraint)
- **Overlaps with Spec 8 and Spec 10** via shared files:
  - `git.ts` also touched by Spec 8 (different functions: `getCommitCount`/`pullWorkspace`/`getFirstCommitDate` vs `gitCommit`/`gitCommitInteractive`)
  - `invoice.ts` also touched by Spec 10 (different line: 81 vs 189)
  - `journal.ts` also touched by Spec 9 (different line: 24 vs 21)
  - Sequential implementation avoids all merge care; if parallel, note the overlaps.
- `src/utils/errors.ts` — `GrindSystemError` already imported in both `git.ts` and `editor.ts`.

## Verification

```bash
bun run typecheck
bun run test -- tests/utils/git.test.ts tests/commands/prune.test.ts tests/utils/editor.test.ts

# Manual smoke tests:
grind save grind          # interactive commit still opens the editor (execFileSync keeps TTY)
grind reject idea 1       # with unrelated WIP present → WIP stays uncommitted
grind prune ideas -y      # same
grind journal             # invalid EDITOR (e.g. EDITOR=/nonexistent) → clean GrindSystemError, exit 2
```
