// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";

export const BARE_REPO_NAME = ".grind.repo.git";
export const MAIN_WORKTREE_NAME = "grind";
export const CONFIG_FILE_NAME = ".grind.json";
export const PROJECT_CONFIG_FILE_NAME = ".project.json";
export const PROJECTS_DIR_NAME = "projects";
export const IDEAS_DIR_NAME = "ideas";
export const JOURNAL_DIR_NAME = "journal";

// --- Workspace roots ---

export function getBareRepoPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, BARE_REPO_NAME);
}

export function getMainWorktreePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, MAIN_WORKTREE_NAME);
}

export function getProjectWorktreePath(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, projectName);
}

export function getProjectFilesPath(workspaceRoot: string, projectName: string): string {
  return path.join(workspaceRoot, projectName, PROJECTS_DIR_NAME, projectName);
}

export function getProjectConfigPath(workspaceRoot: string, projectName: string): string {
  return path.join(getProjectFilesPath(workspaceRoot, projectName), PROJECT_CONFIG_FILE_NAME);
}

export function getProjectIdeaPath(workspaceRoot: string, projectName: string): string {
  return path.join(getProjectFilesPath(workspaceRoot, projectName), "the-idea.md");
}

// --- Main worktree internals ---

export function getGrindConfigPath(mainWorktree: string): string {
  return path.join(mainWorktree, CONFIG_FILE_NAME);
}

export function getIdeasDirPath(mainWorktree: string): string {
  return path.join(mainWorktree, IDEAS_DIR_NAME);
}

export function getProjectsDirPath(mainWorktree: string): string {
  return path.join(mainWorktree, PROJECTS_DIR_NAME);
}

export function getProjectConfigDirPath(mainWorktree: string, projectName: string): string {
  return path.join(mainWorktree, PROJECTS_DIR_NAME, projectName);
}

export function getMainProjectConfigPath(mainWorktree: string, projectName: string): string {
  return path.join(getProjectConfigDirPath(mainWorktree, projectName), PROJECT_CONFIG_FILE_NAME);
}

export function getMainProjectIdeaPath(mainWorktree: string, projectName: string): string {
  return path.join(getProjectConfigDirPath(mainWorktree, projectName), "the-idea.md");
}

export function getJournalDirPath(mainWorktree: string): string {
  return path.join(mainWorktree, JOURNAL_DIR_NAME);
}

export function getInvoiceDirPath(mainWorktree: string, projectName: string, invoiceId: string): string {
  return path.join(getProjectConfigDirPath(mainWorktree, projectName), "invoices", invoiceId);
}
