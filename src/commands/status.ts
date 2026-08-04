// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { getCommitCount, getDefaultBranch, getLastCommitDate } from "../utils/git.js";
import { timeAgo } from "../utils/time.js";
import { RED, GREEN, YELLOW, WHITE } from "../utils/colors.js";
import { collectProjects } from "../utils/project.js";
import { getOpenTasks, getTaskUrgency } from "../utils/task.js";
import { getActiveSession } from "../utils/session.js";
import { Table } from "../utils/table.js";
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
  isActive: boolean;
  isDeadlineOverdue: boolean;
  isDeadlineSoon: boolean;
  hasUnbilled: boolean;
  longTerm: boolean;
  totalSeconds: number;
}

export async function status(): Promise<void> {
  const { workspaceRoot, bareRepo } = await requireWorkspace();
  const defaultBranch = await getDefaultBranch(bareRepo);

  const allProjects = await collectProjects(workspaceRoot);
  const projects = allProjects.filter((p): p is ProjectEntry & { config: ProjectConfig } => p.config !== null);

  if (projects.length === 0) {
    console.log("No active projects. Create one with: grind new project \"name\" <idea-number>");
    return;
  }

  const rowPromises = projects.map(async ({ config, name }): Promise<ProjectRow> => {
    const branch = name;
    const [commitCount, lastCommitDate, openTasks] = await Promise.all([
      getCommitCount(bareRepo, branch, defaultBranch),
      getLastCommitDate(bareRepo, branch),
      getOpenTasks(workspaceRoot, name),
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

    const isActive = getActiveSession(config) !== undefined;

    const now = new Date();
    let isDeadlineOverdue = false;
    let isDeadlineSoon = false;
    if (config.deadline) {
      const deadline = new Date(config.deadline + "T23:59:59Z");
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      isDeadlineOverdue = diffDays < 0;
      isDeadlineSoon = diffDays >= 0 && diffDays <= 7;
    }

    return {
      name: config.name,
      hoursWorked: `${totalHours}h`,
      hoursBilled: `${billedHours}h`,
      taskCount,
      taskUrgency,
      lastSession: lastSessionDisplay,
      lastCommit: lastCommitDate ? timeAgo(new Date(lastCommitDate)) : "never",
      isActive,
      isDeadlineOverdue,
      isDeadlineSoon,
      hasUnbilled,
      longTerm: config.longTerm === true,
      totalSeconds,
    };
  });

  const rows = await Promise.all(rowPromises);

  rows.sort((a, b) => {
    if (a.longTerm !== b.longTerm) return a.longTerm ? 1 : -1;
    if (a.totalSeconds === b.totalSeconds) return a.name.localeCompare(b.name);
    return b.totalSeconds - a.totalSeconds;
  });

  const rowData = rows.map(r => [`${r.longTerm ? "★ " : "  "}${r.name}`, r.hoursWorked, r.hoursBilled, String(r.taskCount), r.lastSession, r.lastCommit]);

  const table = new Table([
    { label: "Project" },
    { label: "Worked", align: "right" },
    { label: "Billed", align: "right" },
    { label: "Tasks", align: "right" },
    { label: "Last Session" },
    { label: "Last Commit" },
  ], rowData);

  table.printHeader();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let nameColor: string | undefined;
    if (row.isActive) {
      nameColor = GREEN;
    } else if (row.isDeadlineOverdue) {
      nameColor = RED;
    } else if (row.isDeadlineSoon) {
      nameColor = YELLOW;
    } else if (row.hasUnbilled) {
      nameColor = YELLOW;
    } else {
      nameColor = WHITE;
    }

    let taskColor: string | undefined;
    if (row.taskUrgency === "overdue") {
      taskColor = RED;
    } else if (row.taskUrgency === "today") {
      taskColor = YELLOW;
    }

    table.printRow([
      { text: rowData[i][0], color: nameColor },
      { text: rowData[i][1] },
      { text: rowData[i][2] },
      { text: rowData[i][3], color: taskColor },
      { text: rowData[i][4] },
      { text: rowData[i][5] },
    ]);
  }
}
