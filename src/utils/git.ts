// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";
import type { GrindConfig } from "../types/index.js";
import { getProjectWorktreePath } from "./paths.js";
import { readProjectConfig } from "./config.js";
import { GrindSystemError } from "./errors.js";
import { fileExists } from "./files.js";

/**
 * Initialize a bare git repository (for use with worktrees)
 */
export async function gitInit(repoPath: string): Promise<void> {
  await $`git init --bare ${repoPath}`.quiet();
}

/**
 * Create a git commit with message (stages all changes first)
 * Refuses to commit if there are unmerged paths, so a conflicted merge
 * can never be committed verbatim (which would corrupt tracked configs).
 */
export async function gitCommit(worktreePath: string, message: string, paths?: string[]): Promise<void> {
  if (paths) {
    await $`git -C ${worktreePath} add ${paths}`.quiet();
  } else {
    await $`git -C ${worktreePath} add -A`.quiet();
  }

  const unmerged = await $`git -C ${worktreePath} ls-files -u`.quiet().nothrow();
  if (unmerged.stdout.toString().trim().length > 0) {
    throw new GrindSystemError(
      "Refusing to commit: there are unmerged paths in this worktree.\n" +
      "Resolve the conflicts first (git status), then retry."
    );
  }

  await $`git -C ${worktreePath} commit -m ${message}`.quiet();
}

/**
 * Create an interactive git commit (opens editor for message)
 * Stages all changes first, then opens the configured git editor
 */
export async function gitCommitInteractive(worktreePath: string): Promise<void> {
  // Stage all changes first
  await $`git -C ${worktreePath} add -A`.quiet();

  const unmerged = await $`git -C ${worktreePath} ls-files -u`.quiet().nothrow();
  if (unmerged.stdout.toString().trim().length > 0) {
    throw new GrindSystemError(
      "Refusing to commit: there are unmerged paths in this worktree.\n" +
      "Resolve the conflicts first (git status), then retry."
    );
  }

  // No shell → no quoting/injection. stdio "inherit" keeps the TTY for interactive editors.
  execFileSync("git", ["-C", worktreePath, "commit"], { stdio: "inherit" });
}

/**
 * Resolve the default branch name for the workspace.
 * Resolution order: explicit config > detected from bare repo > "main"
 */
export async function getDefaultBranch(
  bareRepoPath: string,
  config?: GrindConfig
): Promise<string> {
  if (config?.defaultBranch) {
    return config.defaultBranch;
  }

  try {
    const result = await $`git -C ${bareRepoPath} symbolic-ref HEAD`.quiet();
    const ref = result.stdout.toString().trim();
    if (ref.startsWith("refs/heads/")) {
      return ref.substring("refs/heads/".length);
    }
  } catch {}

  return "main";
}

/**
 * Create initial empty commit in a bare repo (required before adding worktrees)
 * Uses low-level git plumbing commands since bare repos have no working tree
 */
export async function gitInitialCommit(repoPath: string, branchName: string = "main"): Promise<void> {
  // Create empty tree object
  const treeResult = await $`git -C ${repoPath} hash-object -t tree /dev/null`.quiet();
  const treeHash = treeResult.stdout.toString().trim();

  // Create commit from empty tree
  const commitResult = await $`git -C ${repoPath} commit-tree ${treeHash} -m "Initial commit"`.quiet();
  const commitHash = commitResult.stdout.toString().trim();

  // Update branch to point to commit
  await $`git -C ${repoPath} update-ref refs/heads/${branchName} ${commitHash}`.quiet();
}

/**
 * Add a git worktree, creating a new branch or using an existing one.
 * When the local branch doesn't exist but a remote tracking branch does,
 * the worktree is created from origin/<branch> so it stays connected to
 * the project's real branch instead of branching off HEAD (main).
 */
export async function gitAddWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string
): Promise<void> {
  // Check if branch already exists
  try {
    await $`git -C ${repoPath} rev-parse --verify refs/heads/${branch}`.quiet();
    // Branch exists - just add worktree without -b
    await $`git -C ${repoPath} worktree add ${worktreePath} ${branch}`.quiet();
    return;
  } catch {
    // Branch doesn't exist - create it from the remote tracking branch if available
  }

  const remoteExists = await $`git -C ${repoPath} rev-parse --verify refs/remotes/origin/${branch}`.quiet().nothrow();
  if (remoteExists.exitCode === 0) {
    await $`git -C ${repoPath} worktree add ${worktreePath} -b ${branch} origin/${branch}`.quiet();
  } else {
    await $`git -C ${repoPath} worktree add ${worktreePath} -b ${branch}`.quiet();
  }
}

/**
 * Get the number of commits on a branch
 */
export async function getCommitCount(repoPath: string, branch: string): Promise<number> {
  try {
    const result = await $`git -C ${repoPath} rev-list --count ${branch} --not main`.quiet();
    return parseInt(result.stdout.toString().trim(), 10);
  } catch {
    return 0;
  }
}

/**
 * Get the date of the first commit on a branch (ISO format)
 */
export async function getFirstCommitDate(repoPath: string, branch: string): Promise<string | null> {
  try {
    const result = await $`git -C ${repoPath} log ${branch} --not main --reverse --format=%aI`.quiet();
    const firstLine = result.stdout.toString().trim().split("\n")[0];
    return firstLine || null;
  } catch {
    return null;
  }
}

/**
 * Get the date of the most recent commit on a branch (ISO format)
 */
export async function getLastCommitDate(repoPath: string, branch: string): Promise<string | null> {
  try {
    const result = await $`git -C ${repoPath} log ${branch} -1 --format=%aI`.quiet();
    const date = result.stdout.toString().trim();
    return date || null;
  } catch {
    return null;
  }
}

/**
 * Check if a worktree has uncommitted changes
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const result = await $`git -C ${worktreePath} status --porcelain`.quiet();
    return result.stdout.toString().trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get active project worktree names (excludes bare repo and "grind" main worktree)
 */
export async function getActiveWorktrees(bareRepo: string, workspaceRoot: string): Promise<string[]> {
  const result = await $`git -C ${bareRepo} worktree list --porcelain`.quiet();
  const output = result.stdout.toString();

  const names: string[] = [];
  for (const line of output.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const worktreePath = line.replace("worktree ", "");
    const name = path.relative(workspaceRoot, worktreePath);
    if (name === "grind" || worktreePath === bareRepo) continue;
    names.push(name);
  }

  return names;
}

/**
 * Remove a git worktree
 */
export async function removeWorktree(
  bareRepoPath: string,
  worktreePath: string,
  force: boolean = false,
): Promise<void> {
  if (force) {
    await $`git -C ${bareRepoPath} worktree remove --force ${worktreePath}`.quiet();
  } else {
    await $`git -C ${bareRepoPath} worktree remove ${worktreePath}`.quiet();
  }
}

/**
 * Delete a local branch (force, -D)
 */
export async function deleteLocalBranch(bareRepoPath: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${bareRepoPath} branch -D ${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Stage specific files (not all changes)
 */
export async function stageFiles(worktreePath: string, files: string[]): Promise<void> {
  await $`git -C ${worktreePath} add ${files}`.quiet();
}

/**
 * Create a commit without staging (assumes files already staged)
 */
export async function commitOnly(worktreePath: string, message: string): Promise<void> {
  await $`git -C ${worktreePath} commit -m ${message}`.quiet();
}

/**
 * Switch to a branch in a worktree
 */
export async function switchBranch(worktreePath: string, branch: string): Promise<void> {
  await $`git -C ${worktreePath} switch ${branch}`.quiet();
}

/**
 * Merge a branch into the current branch of a worktree
 */
export async function mergeBranch(worktreePath: string, branch: string): Promise<void> {
  await $`git -C ${worktreePath} merge ${branch}`.quiet();
}

/**
 * Read file contents from a git ref (branch/tag/commit) without a worktree
 */
export async function showFile(
  repoPath: string,
  ref: string,
  filePath: string,
): Promise<string | null> {
  try {
    const result = await $`git -C ${repoPath} show ${ref}:${filePath}`.quiet();
    return result.stdout.toString();
  } catch {
    return null;
  }
}

/**
 * List all local branches in the bare repo
 */
export async function listLocalBranches(bareRepoPath: string): Promise<string[]> {
  const result = await $`git -C ${bareRepoPath} branch --format="%(refname:short)"`.quiet();
  return result.stdout.toString().trim().split("\n").filter(b => b);
}

/**
 * Clone a remote repository as a bare repo
 */
export async function cloneBare(url: string, repoPath: string): Promise<void> {
  await $`git clone --bare ${url} ${repoPath}`.quiet();
}

/**
 * Set the fetch refspec for the origin remote
 */
export async function setFetchRefspec(bareRepoPath: string, refspec: string): Promise<void> {
  await $`git -C ${bareRepoPath} config remote.origin.fetch ${refspec}`.quiet();
}

/**
 * Push all branches and tags to the remote (individually, so one failure doesn't block others).
 * Falls back to --force-with-lease for diverged branches.
 */
export async function gitPushAll(bareRepoPath: string): Promise<{ pushed: string[]; forcePushed: string[]; failed: { branch: string; error: string }[] }> {
  const branches = await listLocalBranches(bareRepoPath);
  const pushed: string[] = [];
  const forcePushed: string[] = [];
  const failed: { branch: string; error: string }[] = [];

  for (const branch of branches) {
    try {
      await $`git -C ${bareRepoPath} push origin ${branch}:${branch}`.quiet();
      pushed.push(branch);
    } catch {
      // Normal push failed — try force-with-lease (safe for personal workspaces)
      try {
        await $`git -C ${bareRepoPath} push origin ${branch}:${branch} --force-with-lease`.quiet();
        forcePushed.push(branch);
      } catch (e) {
        failed.push({ branch, error: formatShellError(e) });
      }
    }
  }

  // Tags are all-or-nothing (less likely to conflict)
  try {
    await $`git -C ${bareRepoPath} push origin --tags`.quiet();
  } catch {
    // Tags push failure is non-fatal
  }

  return { pushed, forcePushed, failed };
}

/**
 * Push a single branch and tags to the remote
 */
export async function gitPushBranch(bareRepoPath: string, branch: string): Promise<void> {
  await $`git -C ${bareRepoPath} push origin ${branch}:${branch}`.quiet();
  await $`git -C ${bareRepoPath} push origin --tags`.quiet();
}

/**
 * Fetch a single branch from remote
 */
export async function gitFetchBranch(bareRepoPath: string, branch: string): Promise<void> {
  await $`git -C ${bareRepoPath} fetch origin ${branch}`.quiet();
}

/**
 * Delete a remote branch (best-effort, swallows errors)
 */
export async function gitDeleteRemoteBranch(bareRepoPath: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${bareRepoPath} push origin --delete ${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch all branches from remote
 */
export async function gitFetchAll(bareRepoPath: string): Promise<void> {
  await $`git -C ${bareRepoPath} fetch --all`.quiet();
}

/**
 * Get the remote origin URL from a bare repo
 */
export async function getRemoteUrl(bareRepoPath: string): Promise<string | null> {
  try {
    const result = await $`git -C ${bareRepoPath} remote get-url origin`.quiet();
    return result.stdout.toString().trim();
  } catch {
    return null;
  }
}

/**
 * Set the remote origin URL on a bare repo
 */
export async function setRemoteUrl(bareRepoPath: string, url: string): Promise<void> {
  // Check if origin already exists
  const existing = await getRemoteUrl(bareRepoPath);
  if (existing) {
    await $`git -C ${bareRepoPath} remote set-url origin ${url}`.quiet();
  } else {
    await $`git -C ${bareRepoPath} remote add origin ${url}`.quiet();
  }
}

/**
 * List remote branches (refs/remotes/origin/*) excluding HEAD
 */
export async function getRemoteBranchList(bareRepoPath: string): Promise<string[]> {
  const result = await $`git -C ${bareRepoPath} branch -r --format="%(refname)"`.quiet();
  return result.stdout.toString().trim().split("\n")
    .map(r => r.replace("refs/remotes/", ""))
    .filter(b => b && !b.endsWith("/HEAD"));
}

/**
 * Get the current branch name for a worktree
 */
export async function getCurrentBranch(worktreePath: string): Promise<string> {
  const result = await $`git -C ${worktreePath} rev-parse --abbrev-ref HEAD`.quiet();
  return result.stdout.toString().trim();
}

/**
 * Fast-forward a worktree branch to match its remote tracking branch.
 * Returns true if the update was applied.
 */
export async function fastForwardWorktree(worktreePath: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${worktreePath} merge --ff-only origin/${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a remote branch exists
 */
export async function remoteBranchExists(bareRepoPath: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${bareRepoPath} rev-parse --verify refs/remotes/origin/${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a local branch exists in the bare repo
 */
export async function localBranchExists(bareRepoPath: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${bareRepoPath} rev-parse --verify refs/heads/${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a human-readable message from a Bun ShellError (or any error).
 * Returns the git stderr output when available, otherwise the error message.
 */
export function formatShellError(e: unknown): string {
  if (e instanceof $.ShellError) {
    const stderr = e.stderr.toString().trim();
    return stderr || e.message;
  }
  return String(e);
}

// ── Workflow Methods ──────────────────────────────────────────────────────────
// Higher-level operations that compose primitives for common grind workflows.

/**
 * Push a branch and all tags to the remote.
 * Used by grind save and grind push.
 */
export async function pushWorkspace(bareRepoPath: string, branch: string): Promise<void> {
  await gitPushBranch(bareRepoPath, branch);
}

/**
 * Pull all branches from remote, merge main, and create missing project worktrees.
 * Used by grind pull.
 */
export async function pullWorkspace(
  bareRepoPath: string,
  mainWorktreePath: string,
  workspaceRoot: string,
): Promise<{ fastForwarded: boolean; created: number; skipped: number; updated: string[]; diverged: string[] }> {
  // 1. Fetch all branches
  await gitFetchAll(bareRepoPath);

  // 2. Fast-forward local branches to match remote (best-effort per branch)
  const localBranches = await listLocalBranches(bareRepoPath);
  const updated: string[] = [];
  const diverged: string[] = [];

  for (const branch of localBranches) {
    try {
      const remoteHash = (await $`git -C ${bareRepoPath} rev-parse --verify origin/${branch}`.quiet().nothrow()).stdout.toString().trim();
      if (!remoteHash) continue;

      const localHash = (await $`git -C ${bareRepoPath} rev-parse --verify refs/heads/${branch}`.quiet().nothrow()).stdout.toString().trim();
      if (!localHash || localHash === remoteHash) continue;

    const check = await $`git -C ${bareRepoPath} merge-base --is-ancestor ${localHash} ${remoteHash}`.quiet().nothrow();
    if (check.exitCode === 0) {
      const wtPath = getProjectWorktreePath(workspaceRoot, branch);
      if (await fileExists(wtPath)) {
        // Branch is checked out in a worktree — refresh the working files too, so
        // pull leaves existing worktrees in a workable state instead of just moving
        // the ref (which would desync the files and show phantom diffs).
        if (await fastForwardWorktree(wtPath, branch)) {
          updated.push(branch);
        } else {
          // Worktree has local changes blocking the fast-forward — leave the ref
          // alone and flag it for a manual merge.
          diverged.push(branch);
        }
      } else {
        await $`git -C ${bareRepoPath} update-ref refs/heads/${branch} ${remoteHash}`.quiet();
        updated.push(branch);
      }
    } else {
      diverged.push(branch);
    }
    } catch {
      // Skip on error
    }
  }

  // 3. Merge main (non-ff-only to handle divergence)
  let fastForwarded = false;
  try {
    await $`git -C ${mainWorktreePath} merge origin/main --no-edit`.quiet();
    fastForwarded = true;
  } catch {
    // Merge conflicts — let user know but don't fail
  }

  // 4. Find project branches on remote
  const remoteBranches = await getRemoteBranchList(bareRepoPath);
  const projectBranches = remoteBranches
    .map(b => b.replace("origin/", ""))
    .filter(b => b !== "main" && b !== "HEAD");

  // 5. Get existing worktrees
  const existingWorktrees = new Set(await getActiveWorktrees(bareRepoPath, workspaceRoot));

  // 6. Create missing worktrees
  let created = 0;
  let skipped = 0;

  for (const branch of projectBranches) {
    const wtPath = getProjectWorktreePath(workspaceRoot, branch);
    if (await fileExists(wtPath) || existingWorktrees.has(branch)) {
      continue;
    }

    // Skip canceled or published projects.
    // The config lives in the main worktree (single source of truth) — never
    // read it from the project worktree, which won't exist for archived projects.
    let status: string | undefined;
    const mainConfig = await readProjectConfig(workspaceRoot, branch);
    if (mainConfig) {
      status = mainConfig.status;
    } else {
      // Fallback: read the config from main's branch tree (not yet checked out).
      const mainBranch = await getCurrentBranch(mainWorktreePath);
      const raw = await showFile(bareRepoPath, mainBranch, `projects/${branch}/.project.json`);
      if (raw) {
        try { status = JSON.parse(raw).status; } catch { /* not a config */ }
      }
    }

    if (status === "canceled" || status === "published") {
      skipped++;
      continue;
    }

    try {
      await gitAddWorktree(bareRepoPath, wtPath, branch);
      created++;
    } catch {
      skipped++;
    }
  }

  return { fastForwarded, created, skipped, updated, diverged };
}

/**
 * Remove a project's worktree, local branch, and optionally remote branch.
 * Used by grind cancel and grind publish.
 */
export async function removeProject(
  bareRepoPath: string,
  worktreePath: string,
  branch: string,
  options: { force?: boolean; deleteRemote?: boolean } = {},
): Promise<{ worktreeRemoved: boolean; localDeleted: boolean; remoteDeleted: boolean }> {
  let worktreeRemoved = false;
  let localDeleted = false;
  let remoteDeleted = false;

  try {
    await removeWorktree(bareRepoPath, worktreePath, options.force);
    worktreeRemoved = true;
  } catch {
    // worktree removal failed
  }

  localDeleted = await deleteLocalBranch(bareRepoPath, branch);

  if (options.deleteRemote) {
    remoteDeleted = await gitDeleteRemoteBranch(bareRepoPath, branch);
  }

  return { worktreeRemoved, localDeleted, remoteDeleted };
}
