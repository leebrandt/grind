// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { fileExists } from "./files.js";
import { GrindUserError } from "./errors.js";
import { BARE_REPO_NAME, MAIN_WORKTREE_NAME, getBareRepoPath, getMainWorktreePath, getGrindConfigPath } from "./paths.js";

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

  if (firstSegment === MAIN_WORKTREE_NAME || firstSegment === BARE_REPO_NAME) return null;

  return firstSegment;
}

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

  const mainWorktreePath = getMainWorktreePath(workspaceRoot);
  const configPath = getGrindConfigPath(mainWorktreePath);

  if (await fileExists(configPath)) {
    return mainWorktreePath;
  }

  return null;
}

/**
 * Require workspace context or exit with error.
 * Returns { workspaceRoot, mainWorktree, bareRepo }.
 */
export async function requireWorkspace(): Promise<{
  workspaceRoot: string;
  mainWorktree: string;
  bareRepo: string;
}> {
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new GrindUserError("Not in a grind workspace.");
  }

  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    throw new GrindUserError("Could not find main worktree.");
  }

  const bareRepo = getBareRepoPath(workspaceRoot);

  return { workspaceRoot, mainWorktree, bareRepo };
}

