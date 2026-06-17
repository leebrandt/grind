// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import {
  getBareRepoPath,
  getMainWorktreePath,
  getProjectWorktreePath,
  getProjectFilesPath,
  getProjectConfigPath,
  getProjectIdeaPath,
  getGrindConfigPath,
  getIdeasDirPath,
  getProjectsDirPath,
  getProjectConfigDirPath,
  getMainProjectConfigPath,
  getMainProjectIdeaPath,
  getJournalDirPath,
  getInvoiceDirPath,
  BARE_REPO_NAME,
  MAIN_WORKTREE_NAME,
  CONFIG_FILE_NAME,
  PROJECT_CONFIG_FILE_NAME,
  PROJECTS_DIR_NAME,
  IDEAS_DIR_NAME,
  JOURNAL_DIR_NAME,
} from "../../src/utils/paths.js";

describe("paths", () => {
  const workspaceRoot = "/home/user/workspace";
  const mainWorktree = "/home/user/workspace/grind";
  const projectName = "my-project";

  describe("workspace roots", () => {
    it("getBareRepoPath", () => {
      expect(getBareRepoPath(workspaceRoot)).toBe(
        path.join(workspaceRoot, BARE_REPO_NAME),
      );
    });

    it("getMainWorktreePath", () => {
      expect(getMainWorktreePath(workspaceRoot)).toBe(
        path.join(workspaceRoot, MAIN_WORKTREE_NAME),
      );
    });

    it("getProjectWorktreePath", () => {
      expect(getProjectWorktreePath(workspaceRoot, projectName)).toBe(
        path.join(workspaceRoot, projectName),
      );
    });

    it("getProjectFilesPath", () => {
      expect(getProjectFilesPath(workspaceRoot, projectName)).toBe(
        path.join(workspaceRoot, projectName, PROJECTS_DIR_NAME, projectName),
      );
    });

    it("getProjectConfigPath", () => {
      expect(getProjectConfigPath(workspaceRoot, projectName)).toBe(
        path.join(workspaceRoot, projectName, PROJECTS_DIR_NAME, projectName, PROJECT_CONFIG_FILE_NAME),
      );
    });

    it("getProjectIdeaPath", () => {
      expect(getProjectIdeaPath(workspaceRoot, projectName)).toBe(
        path.join(workspaceRoot, projectName, PROJECTS_DIR_NAME, projectName, "the-idea.md"),
      );
    });
  });

  describe("main worktree internals", () => {
    it("getGrindConfigPath", () => {
      expect(getGrindConfigPath(mainWorktree)).toBe(
        path.join(mainWorktree, CONFIG_FILE_NAME),
      );
    });

    it("getIdeasDirPath", () => {
      expect(getIdeasDirPath(mainWorktree)).toBe(
        path.join(mainWorktree, IDEAS_DIR_NAME),
      );
    });

    it("getProjectsDirPath", () => {
      expect(getProjectsDirPath(mainWorktree)).toBe(
        path.join(mainWorktree, PROJECTS_DIR_NAME),
      );
    });

    it("getProjectConfigDirPath", () => {
      expect(getProjectConfigDirPath(mainWorktree, projectName)).toBe(
        path.join(mainWorktree, PROJECTS_DIR_NAME, projectName),
      );
    });

    it("getMainProjectConfigPath", () => {
      expect(getMainProjectConfigPath(mainWorktree, projectName)).toBe(
        path.join(mainWorktree, PROJECTS_DIR_NAME, projectName, PROJECT_CONFIG_FILE_NAME),
      );
    });

    it("getMainProjectIdeaPath", () => {
      expect(getMainProjectIdeaPath(mainWorktree, projectName)).toBe(
        path.join(mainWorktree, PROJECTS_DIR_NAME, projectName, "the-idea.md"),
      );
    });

    it("getJournalDirPath", () => {
      expect(getJournalDirPath(mainWorktree)).toBe(
        path.join(mainWorktree, JOURNAL_DIR_NAME),
      );
    });

    it("getInvoiceDirPath", () => {
      const invoiceId = "2026-01-27T14-30-15";
      expect(getInvoiceDirPath(mainWorktree, projectName, invoiceId)).toBe(
        path.join(mainWorktree, PROJECTS_DIR_NAME, projectName, "invoices", invoiceId),
      );
    });
  });
});
