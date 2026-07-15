import type { Task } from "../types/index.js";
import { readProjectConfig, writeProjectConfig } from "./config.js";
import { GrindUserError } from "./errors.js";

export async function getTasks(workspaceRoot: string, projectName: string): Promise<Task[]> {
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) return [];
  return config.tasks ?? [];
}

export async function getOpenTasks(workspaceRoot: string, projectName: string): Promise<Task[]> {
  const tasks = await getTasks(workspaceRoot, projectName);
  return tasks.filter((t) => t.done === false);
}

export async function addTask(
  workspaceRoot: string,
  projectName: string,
  description: string,
  dueDate?: string
): Promise<Task> {
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    throw new GrindUserError(`Project "${projectName}" not found`);
  }

  const tasks = config.tasks ?? [];
  const nextId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;

  const task: Task = {
    id: nextId,
    description,
    done: false,
    createdAt: new Date().toISOString(),
  };

  if (dueDate) {
    task.dueDate = dueDate;
  }

  config.tasks = [...tasks, task];
  await writeProjectConfig(workspaceRoot, projectName, config);

  return task;
}

export async function completeTask(
  workspaceRoot: string,
  projectName: string,
  taskId: number
): Promise<Task> {
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    throw new GrindUserError(`Project "${projectName}" not found`);
  }

  const tasks = config.tasks ?? [];
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new GrindUserError(`Task #${taskId} not found in project "${projectName}"`);
  }

  task.done = true;
  task.completedAt = new Date().toISOString();

  config.tasks = tasks;
  await writeProjectConfig(workspaceRoot, projectName, config);

  return task;
}

export function getTaskUrgency(tasks: Task[], now?: Date): "overdue" | "today" | "soon" | "none" {
  const today = now ?? new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let highest: "overdue" | "today" | "soon" | "none" = "none";

  for (const task of tasks) {
    if (task.done || !task.dueDate) continue;

    if (task.dueDate < todayStr) {
      return "overdue";
    } else if (task.dueDate === todayStr) {
      highest = "today";
    } else {
      const diff = (new Date(task.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 3 && highest !== "today") {
        highest = "soon";
      }
    }
  }

  return highest;
}
