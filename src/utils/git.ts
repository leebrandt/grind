import { execSync } from "child_process";

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
 * Check if a worktree has uncommitted changes
 */
export async function hasUncommittedChanges(path: string): Promise<boolean> {
  try {
    const result = await $`git -C ${path} status --porcelain`.quiet();
    return result.stdout.toString().trim().length > 0;
  } catch {
    return false;
  }
}
