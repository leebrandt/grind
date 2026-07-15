// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import { requireWorkspace } from "../utils/workspace.js";
import { getCommitCount, getLastCommitDate } from "../utils/git.js";
import { timeAgo } from "../utils/time.js";
import { DIM, RED, GREEN, YELLOW, RESET } from "../utils/colors.js";
import { collectProjects } from "../utils/project.js";
import { getOpenTasks, getTaskUrgency } from "../utils/task.js";
import type { ProjectConfig } from "../types/index.js";
import type { ProjectEntry } from "../utils/project.js";

interface ProjectRow {
  name: string;
  hoursWorked: string;
  hoursBilled: string;
  taskCount: number;
  taskUrgency: "overdue" | "today" | "soon" | "none";
  lastSession: string;
  lastCommit: string;
  hasChanges: boolean;
  hasUnbilled: boolean;
  longTerm: boolean;
  sortKey: number;
}

export async function status(): Promise<void> {
  const { workspaceRoot, bareRepo } = await requireWorkspace();

  const allProjects = await collectProjects(workspaceRoot);
  const projects = allProjects.filter((p): p is ProjectEntry & { config: ProjectConfig } => p.config !== null);

  if (projects.length === 0) {
    console.log("No active projects. Create one with: grind new project \"name\" <idea-number>");
    return;
  }

  const rowPromises = projects.map(async ({ config, name, worktreePath }): Promise<ProjectRow> => {
    const branch = name;
    const [commitCount, lastCommitDate, openTasks, hasChanges] = await Promise.all([
      getCommitCount(bareRepo, branch),
      getLastCommitDate(bareRepo, branch),
      getOpenTasks(workspaceRoot, name),
      $`git -C ${worktreePath} status --porcelain`.quiet().then(r => r.stdout.toString().trim().length > 0).catch(() => false),
    ]);

    const taskCount = openTasks.length;
    const taskUrgency = getTaskUrgency(openTasks);

    const totalSeconds = config.time.reduce((sum, s) => sum + s.rounded, 0);
    const billedSeconds = config.time.filter(s => s.invoiced).reduce((sum, s) => sum + s.rounded, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    const billedHours = (billedSeconds / 3600).toFixed(1);
    const hasUnbilled = totalSeconds > billedSeconds;

    const sessions = config.time;
    const lastSessionDate = sessions.length > 0 ? sessions[sessions.length - 1].start : null;
    const lastSessionDisplay = lastSessionDate ? timeAgo(new Date(lastSessionDate)) : "never";

    const sortKey = lastSessionDate ? new Date(lastSessionDate).getTime() : 0;

    return {
      name: config.name,
      hoursWorked: `${totalHours}h`,
      hoursBilled: `${billedHours}h`,
      taskCount,
      taskUrgency,
      lastSession: lastSessionDisplay,
      lastCommit: lastCommitDate ? timeAgo(new Date(lastCommitDate)) : "never",
      hasChanges,
      hasUnbilled,
      longTerm: config.longTerm === true,
      sortKey,
    };
  });

  const rows = await Promise.all(rowPromises);

  rows.sort((a, b) => {
    if (a.sortKey === 0 && b.sortKey === 0) return a.name.localeCompare(b.name);
    if (a.sortKey === 0) return -1;
    if (b.sortKey === 0) return 1;
    return a.sortKey - b.sortKey;
  });

  const cols = {
    name: Math.max("Project".length, ...rows.map(r => r.name.length)),
    hoursWorked: Math.max("Worked".length, ...rows.map(r => r.hoursWorked.length)),
    hoursBilled: Math.max("Billed".length, ...rows.map(r => r.hoursBilled.length)),
    tasks: Math.max("Tasks".length, ...rows.map(r => String(r.taskCount).length)),
    lastSession: Math.max("Last Session".length, ...rows.map(r => r.lastSession.length)),
    lastCommit: Math.max("Last Commit".length, ...rows.map(r => r.lastCommit.length)),
  };

  const header = `  ${"Project".padEnd(cols.name)}  ${"Worked".padStart(cols.hoursWorked)}  ${"Billed".padStart(cols.hoursBilled)}  ${"Tasks".padStart(cols.tasks)}  ${"Last Session".padEnd(cols.lastSession)}  ${"Last Commit".padEnd(cols.lastCommit)}`;
  const divider = `  ${"─".repeat(cols.name)}  ${"─".repeat(cols.hoursWorked)}  ${"─".repeat(cols.hoursBilled)}  ${"─".repeat(cols.tasks)}  ${"─".repeat(cols.lastSession)}  ${"─".repeat(cols.lastCommit)}`;

  console.log(`${DIM}${header}${RESET}`);
  console.log(`${DIM}${divider}${RESET}`);

  for (const row of rows) {
    const prefix = row.longTerm ? "★ " : "  ";
    const paddedName = row.name.padEnd(cols.name);
    let nameDisplay: string;
    if (row.sortKey === 0 || row.hasChanges) {
      nameDisplay = `${prefix}${RED}${paddedName}${RESET}`;
    } else if (row.hasUnbilled) {
      nameDisplay = `${prefix}${GREEN}${paddedName}${RESET}`;
    } else {
      nameDisplay = `${prefix}${paddedName}`;
    }

    const taskCountStr = String(row.taskCount).padStart(cols.tasks);
    let taskDisplay: string;
    if (row.taskUrgency === "overdue") {
      taskDisplay = `${RED}${taskCountStr}${RESET}`;
    } else if (row.taskUrgency === "today") {
      taskDisplay = `${YELLOW}${taskCountStr}${RESET}`;
    } else {
      taskDisplay = taskCountStr;
    }

    console.log(`${nameDisplay}  ${row.hoursWorked.padStart(cols.hoursWorked)}  ${row.hoursBilled.padStart(cols.hoursBilled)}  ${taskDisplay}  ${row.lastSession.padEnd(cols.lastSession)}  ${row.lastCommit.padEnd(cols.lastCommit)}`);
  }
}
