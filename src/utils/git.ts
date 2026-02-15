import { execSync } from "child_process";
import path from "node:path";
import { $ } from "bun";

/**
 * Initialize a bare git repository (for use with worktrees)
 */
export async function gitInit(path: string): Promise<void> {
  await $`git init --bare ${path}`.quiet();
}

/**
 * Create a git commit with message (stages all changes first)
 */
export async function gitCommit(path: string, message: string): Promise<void> {
  await $`git -C ${path} add -A`.quiet();
  await $`git -C ${path} commit -m ${message}`.quiet();
}

/**
 * Create an interactive git commit (opens editor for message)
 * Stages all changes first, then opens the configured git editor
 */
export async function gitCommitInteractive(path: string): Promise<void> {
  // Stage all changes first
  await $`git -C ${path} add -A`.quiet();

  // Run git commit without -m to open editor
  // execSync properly forwards the TTY for interactive editors like vi
  execSync(`git -C ${JSON.stringify(path)} commit`, { stdio: "inherit" });
}

/**
 * Create initial empty commit in a bare repo (required before adding worktrees)
 * Uses low-level git plumbing commands since bare repos have no working tree
 */
export async function gitInitialCommit(repoPath: string): Promise<void> {
  // Create empty tree object
  const treeResult = await $`git -C ${repoPath} hash-object -t tree /dev/null`.quiet();
  const treeHash = treeResult.stdout.toString().trim();

  // Create commit from empty tree
  const commitResult = await $`git -C ${repoPath} commit-tree ${treeHash} -m "Initial commit"`.quiet();
  const commitHash = commitResult.stdout.toString().trim();

  // Update main branch to point to commit
  await $`git -C ${repoPath} update-ref refs/heads/main ${commitHash}`.quiet();
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
    const result = await $`git -C ${repoPath} rev-list --count ${branch}`.quiet();
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
    const result = await $`git -C ${repoPath} log ${branch} --reverse --format=%aI`.quiet();
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
