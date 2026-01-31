import { stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./files.js";

/**
 * Derive the current project name from the working directory.
 * Returns the directory name immediately under the workspace root,
 * or null if not inside a project worktree.
 */
export async function getCurrentProjectName(): Promise<string | null> {
  const cwd = process.cwd();
  const workspaceRoot = await getWorkspaceRoot(cwd);
  if (!workspaceRoot) return null;

  const relative = path.relative(workspaceRoot, cwd);
  if (!relative || relative.startsWith("..")) return null;

  const firstSegment = relative.split(path.sep)[0];

  // The "grind" directory is the main worktree, not a project
  if (firstSegment === "grind" || firstSegment === ".grind.repo.git") return null;

  return firstSegment;
}

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

