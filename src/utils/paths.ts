import path from "node:path";

const BARE_REPO_NAME = ".grind.repo.git";
const MAIN_WORKTREE_NAME = "grind";

// Workspace structure
export function getMainWorktreePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, MAIN_WORKTREE_NAME);
}

export function getBareRepoPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, BARE_REPO_NAME);
}

// Config paths
export function getGrindConfigPath(mainWorktree: string): string {
  return path.join(mainWorktree, ".grind.json");
}

/**
 * Path to .project.json in the main worktree (single source of truth).
 * All reads and writes of project config go through this path.
 */
export function getProjectConfigPath(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, MAIN_WORKTREE_NAME, "projects", projectName, ".project.json");
}

/**
 * @deprecated Use getProjectConfigPath — kept as alias for backward compat.
 */
export function getMainProjectConfigPath(mainWorktree: string, projectName: string): string {
  return path.join(mainWorktree, "projects", projectName, ".project.json");
}

// Project files
export function getProjectIdeaFilePath(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, MAIN_WORKTREE_NAME, "projects", projectName, "the-idea.md");
}

export function getProjectWorktreePath(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, projectName);
}

export function getProjectFilesPath(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, projectName, "projects", projectName);
}

// Global directories (under main worktree)
export function getIdeasDirPath(mainWorktree: string): string {
  return path.join(mainWorktree, "ideas");
}

export function getJournalDirPath(mainWorktree: string): string {
  return path.join(mainWorktree, "journal");
}

export function getProjectsDirPath(mainWorktree: string): string {
  return path.join(mainWorktree, "projects");
}

export function getProjectDirInMainPath(mainWorktree: string, projectName: string): string {
  return path.join(mainWorktree, "projects", projectName);
}

// Invoice
export function getInvoiceDirPath(mainWorktree: string, projectName: string, timestamp: string): string {
  return path.join(mainWorktree, "projects", projectName, "invoices", timestamp);
}
