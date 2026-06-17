// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { readFile } from "node:fs/promises";
import { getActiveWorktrees } from "./git.js";
import type { ProjectConfig } from "../types/index.js";
import {
  getBareRepoPath,
  getProjectConfigPath,
  getProjectWorktreePath,
} from "./paths.js";

export interface ProjectEntry {
  name: string;
  worktreePath: string;
  config: ProjectConfig | null;
}

/**
 * Collect all active project worktrees (excluding main "grind" worktree)
 * and load their configs.
 */
export async function collectProjects(workspaceRoot: string): Promise<ProjectEntry[]> {
  const bareRepo = getBareRepoPath(workspaceRoot);
  const worktreeNames = await getActiveWorktrees(bareRepo, workspaceRoot);

  const projects: ProjectEntry[] = [];
  for (const name of worktreeNames) {
    const configPath = getProjectConfigPath(workspaceRoot, name);
    try {
      const content = await readFile(configPath, "utf-8");
      projects.push({
        name,
        worktreePath: getProjectWorktreePath(workspaceRoot, name),
        config: JSON.parse(content) as ProjectConfig,
      });
    } catch {
      projects.push({
        name,
        worktreePath: getProjectWorktreePath(workspaceRoot, name),
        config: null,
      });
    }
  }

  return projects;
}
