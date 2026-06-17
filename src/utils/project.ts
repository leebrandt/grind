// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { readFile } from "node:fs/promises";
import { getActiveWorktrees } from "./git.js";
import type { ProjectConfig } from "../types/index.js";

export interface ProjectEntry {
  name: string;
  worktreePath: string;
  config: ProjectConfig | null;
}

const BARE_REPO_NAME = ".grind.repo.git";

/**
 * Collect all active project worktrees (excluding main "grind" worktree)
 * and load their configs.
 */
export async function collectProjects(workspaceRoot: string): Promise<ProjectEntry[]> {
  const bareRepo = path.join(workspaceRoot, BARE_REPO_NAME);
  const worktreeNames = await getActiveWorktrees(bareRepo, workspaceRoot);

  const projects: ProjectEntry[] = [];
  for (const name of worktreeNames) {
    const configPath = path.join(workspaceRoot, name, "projects", name, ".project.json");
    try {
      const content = await readFile(configPath, "utf-8");
      projects.push({
        name,
        worktreePath: path.join(workspaceRoot, name),
        config: JSON.parse(content) as ProjectConfig,
      });
    } catch {
      projects.push({
        name,
        worktreePath: path.join(workspaceRoot, name),
        config: null,
      });
    }
  }

  return projects;
}
