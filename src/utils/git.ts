// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { execSync } from "node:child_process";
import path from "node:path";
import { $ } from "bun";
import type { GrindConfig } from "../types/index.js";

/**
 * Initialize a bare git repository (for use with worktrees)
 */
export async function gitInit(repoPath: string): Promise<void> {
  await $`git init --bare ${repoPath}`.quiet();
}

/**
 * Create a git commit with message (stages all changes first)
 */
export async function gitCommit(worktreePath: string, message: string): Promise<void> {
  await $`git -C ${worktreePath} add -A`.quiet();
  await $`git -C ${worktreePath} commit -m ${message}`.quiet();
}

/**
 * Create an interactive git commit (opens editor for message)
 * Stages all changes first, then opens the configured git editor
 */
export async function gitCommitInteractive(worktreePath: string): Promise<void> {
  // Stage all changes first
  await $`git -C ${worktreePath} add -A`.quiet();

  // Run git commit without -m to open editor
  // execSync properly forwards the TTY for interactive editors like vi
  execSync(`git -C ${JSON.stringify(worktreePath)} commit`, { stdio: "inherit" });
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
 * Add a git worktree, creating a new branch or using an existing one
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
  } catch {
    // Branch doesn't exist - create it
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
 * Push all branches and tags to the remote
 */
export async function gitPushAll(bareRepoPath: string): Promise<void> {
  await $`git -C ${bareRepoPath} push origin --all`.quiet();
  await $`git -C ${bareRepoPath} push origin --tags`.quiet();
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
  const result = await $`git -C ${bareRepoPath} branch -r --format="%(refname:short)"`.quiet();
  return result.stdout.toString().trim().split("\n")
    .filter(b => b && b !== "origin/HEAD");
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
 * Push a project branch to a specific remote URL (for per-project push).
 */
export async function gitPushToUrl(bareRepoPath: string, branch: string, remoteUrl: string): Promise<void> {
  await $`git -C ${bareRepoPath} push ${remoteUrl} ${branch}:${branch}`.quiet();
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
