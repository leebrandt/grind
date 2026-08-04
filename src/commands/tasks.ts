// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { requireWorkspace } from "../utils/workspace.js";
import { collectProjects } from "../utils/project.js";
import { readProjectConfig } from "../utils/config.js";
import { getOpenTasks, getTasks, addTask, completeTask } from "../utils/task.js";
import { parseDate } from "../utils/dates.js";
import { GrindUserError } from "../utils/errors.js";
import { DIM, RED, GREEN, YELLOW } from "../utils/colors.js";
import { toLocalDateString } from "../utils/time.js";
import { Table } from "../utils/table.js";
import type { Task } from "../types/index.js";

interface TaskRow {
  id: number;
  description: string;
  due: string;
  dueDate: string | undefined;
  completed: boolean;
  projectName?: string;
}

function sortTaskRows(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

function getDueDisplay(task: Task): string {
  if (!task.dueDate) return "—";
  return task.dueDate;
}

export function getDueColor(dueDate: string | undefined, now: Date): string {
  if (!dueDate) return "";
  const todayStr = toLocalDateString(now);
  if (dueDate < todayStr) return RED;
  if (dueDate === todayStr) return RED;
  const diff = (new Date(dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 3) return YELLOW;
  return GREEN;
}

function printTaskTable(rows: TaskRow[], showProject: boolean, now: Date): void {
  if (rows.length === 0) return;

  const columns = showProject
    ? [{ label: "#", align: "right" as const }, { label: "Project" }, { label: "Task" }, { label: "Due" }]
    : [{ label: "#", align: "right" as const }, { label: "Task" }, { label: "Due" }];

  const rowData = rows.map(r => showProject
    ? [String(r.id), r.projectName ?? "", r.description, r.due]
    : [String(r.id), r.description, r.due],
  );

  const table = new Table(columns, rowData);
  table.printHeader();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dueColor = getDueColor(row.dueDate, now);
    const dim = row.completed ? DIM : undefined;

    const cells = showProject
      ? [
          { text: String(row.id) },
          { text: row.projectName ?? "" },
          { text: row.description, color: dim },
          { text: row.due, color: dueColor && dim ? `${dim}${dueColor}` : dueColor || dim },
        ]
      : [
          { text: String(row.id) },
          { text: row.description, color: dim },
          { text: row.due, color: dueColor && dim ? `${dim}${dueColor}` : dueColor || dim },
        ];

    console.log(table.row(cells));
  }
}

export async function listAllTasks(options: { all?: boolean }): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();
  const allProjects = await collectProjects(workspaceRoot);

  const taskRows: TaskRow[] = [];
  const now = new Date();

  for (const project of allProjects) {
    if (!project.config) continue;
    const tasks = options.all
      ? await getTasks(workspaceRoot, project.name)
      : await getOpenTasks(workspaceRoot, project.name);

    for (const task of tasks) {
      taskRows.push({
        id: task.id,
        description: task.description,
        due: getDueDisplay(task),
        dueDate: task.dueDate,
        completed: task.done,
        projectName: project.name,
      });
    }
  }

  const sorted = sortTaskRows(taskRows);

  if (sorted.length === 0) {
    console.log("All caught up! No open tasks.");
    return;
  }

  printTaskTable(sorted, true, now);
}

export async function listProjectTasks(project: string, options: { all?: boolean }): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const config = await readProjectConfig(workspaceRoot, project);
  if (!config) {
    throw new GrindUserError(`Project "${project}" not found`);
  }

  const tasks = options.all
    ? await getTasks(workspaceRoot, project)
    : await getOpenTasks(workspaceRoot, project);

  const now = new Date();
  const taskRows: TaskRow[] = tasks.map(task => ({
    id: task.id,
    description: task.description,
    due: getDueDisplay(task),
    dueDate: task.dueDate,
    completed: task.done,
  }));

  const sorted = sortTaskRows(taskRows);

  if (sorted.length === 0) {
    console.log(`No open tasks. Add one with: grind tasks add ${project} "My task"`);
    return;
  }

  printTaskTable(sorted, false, now);
}

export async function addTaskToProject(project: string, description: string, options: { due?: string }): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const config = await readProjectConfig(workspaceRoot, project);
  if (!config) {
    throw new GrindUserError(`Project "${project}" not found`);
  }

  let dueDate: string | undefined;
  if (options.due) {
    dueDate = parseDate(options.due);
  }

  const task = await addTask(workspaceRoot, project, description, dueDate);
  console.log(`✓ Task ${task.id} added: ${task.description}`);
}

export async function completeProjectTask(project: string, taskId: string): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const config = await readProjectConfig(workspaceRoot, project);
  if (!config) {
    throw new GrindUserError(`Project "${project}" not found`);
  }

  const id = parseInt(taskId, 10);
  if (isNaN(id)) {
    throw new GrindUserError(`Invalid task ID: "${taskId}"`);
  }

  const task = await completeTask(workspaceRoot, project, id);
  console.log(`✓ Task ${task.id} completed`);
}
