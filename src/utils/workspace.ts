import { stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./files.js";

const BARE_REPO_NAME = ".grind.repo.git";
const MAIN_WORKTREE_NAME = "grind";
const CONFIG_FILE_NAME = ".grind.json";

/**
 * Find the bare repo by scanning up from startPath
 * Returns the path to .grind.repo.git or null if not found
 */
export async function findBareRepo(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);

  while (currentPath !== path.dirname(currentPath)) {
    const bareRepoPath = path.join(currentPath, BARE_REPO_NAME);
    if (await fileExists(bareRepoPath)) {
      return bareRepoPath;
    }
    // Also check parent (worktrees are siblings to bare repo)
    const parentBareRepoPath = path.join(path.dirname(currentPath), BARE_REPO_NAME);
    if (await fileExists(parentBareRepoPath)) {
      return parentBareRepoPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

/**
 * Get the workspace root (parent directory containing .grind.repo.git)
 */
export async function getWorkspaceRoot(startPath: string): Promise<string | null> {
  const bareRepo = await findBareRepo(startPath);
  if (!bareRepo) return null;
  return path.dirname(bareRepo);
}

/**
 * Find the main worktree (grind/) which contains .grind.json
 */
export async function findMainWorktree(startPath: string): Promise<string | null> {
  const workspaceRoot = await getWorkspaceRoot(startPath);
  if (!workspaceRoot) return null;

  const mainWorktreePath = path.join(workspaceRoot, MAIN_WORKTREE_NAME);
  const configPath = path.join(mainWorktreePath, CONFIG_FILE_NAME);

  if (await fileExists(configPath)) {
    return mainWorktreePath;
  }

  return null;
}

/**
 * Check if current directory is inside a project worktree (not main)
 */
export async function isProjectWorktree(currentPath: string): Promise<boolean> {
  const workspaceRoot = await getWorkspaceRoot(currentPath);
  if (!workspaceRoot) return false;

  const resolvedPath = path.resolve(currentPath);
  const mainWorktreePath = path.join(workspaceRoot, MAIN_WORKTREE_NAME);

  // If we're in the main worktree, it's not a project
  if (resolvedPath.startsWith(mainWorktreePath)) {
    return false;
  }

  // If we're in a sibling directory to the bare repo, it's a project worktree
  const parentDir = path.dirname(resolvedPath);
  return parentDir === workspaceRoot || resolvedPath.startsWith(workspaceRoot);
}

/**
 * Get the current project name (directory name of current worktree)
 */
export async function getCurrentProjectName(currentPath: string): Promise<string | null> {
  if (!(await isProjectWorktree(currentPath))) {
    return null;
  }

  const workspaceRoot = await getWorkspaceRoot(currentPath);
  if (!workspaceRoot) return null;

  const resolvedPath = path.resolve(currentPath);
  
  // Extract the first directory component after workspace root
  const relativePath = path.relative(workspaceRoot, resolvedPath);
  const projectName = relativePath.split(path.sep)[0];

  // Don't return if it's the bare repo or main worktree
  if (projectName === BARE_REPO_NAME || projectName === MAIN_WORKTREE_NAME) {
    return null;
  }

  return projectName;
}
