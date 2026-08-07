# Spec: Task Utilities

## Goal

Create utility functions for task CRUD operations on project configs. All functions read/write `.project.json` via existing config utilities. This decouples task logic from the command layer.

## Files to create

- `src/utils/task.ts` — task utility functions
- `tests/utils/task.test.ts` — tests

## Changes

### 1. Create `src/utils/task.ts`

All functions take `workspaceRoot: string` and `projectName: string` as the first two parameters, following the existing config utility pattern.

```typescript
import type { Task } from "../types/index.js";
import { readProjectConfig, writeProjectConfig } from "./config.js";
import { GrindUserError } from "./errors.js";

/**
 * Get all tasks for a project. Returns empty array if no tasks field exists.
 */
export async function getTasks(workspaceRoot: string, projectName: string): Promise<Task[]>

/**
 * Get open (not done) tasks for a project.
 */
export async function getOpenTasks(workspaceRoot: string, projectName: string): Promise<Task[]>

/**
 * Add a task to a project. Returns the created task.
 * Assigns the next sequential ID (max existing ID + 1, or 1 if no tasks).
 * Throws GrindUserError if project config not found.
 */
export async function addTask(
  workspaceRoot: string,
  projectName: string,
  description: string,
  dueDate?: string
): Promise<Task>

/**
 * Mark a task as complete. Sets done=true and completedAt to current timestamp.
 * Throws GrindUserError if project not found or task ID not found.
 */
export async function completeTask(
  workspaceRoot: string,
  projectName: string,
  taskId: number
): Promise<Task>

/**
 * Get the highest urgency level for a project's open tasks.
 * Returns: "overdue" | "today" | "soon" | "none"
 * Used by status integration for color coding.
 */
export function getTaskUrgency(tasks: Task[], now?: Date): "overdue" | "today" | "soon" | "none"
```

#### Implementation details

- `getTasks`: reads config, returns `config.tasks ?? []`
- `getOpenTasks`: filters `getTasks` result where `done === false`
- `addTask`: reads config, computes next ID, pushes new task, writes config. If `dueDate` is provided, it's already in `YYYY-MM-DD` format (parsed by the date utility before calling this).
- `completeTask`: reads config, finds task by ID, sets `done = true` and `completedAt = new Date().toISOString()`, writes config. Throws if task ID not found.
- `getTaskUrgency`: pure function, no I/O. Takes a task array and optional `now` Date. Logic:
  - Iterate open tasks, compare `dueDate` to `now`
  - If any task's due date < today → `"overdue"`
  - If any task's due date === today → `"today"`
  - If any task's due date within 3 days → `"soon"`
  - Otherwise → `"none"`

### 2. Create `tests/utils/task.test.ts`

Mock `node:fs/promises` at the module level (following existing patterns). Each test creates an in-memory JSON string for `.project.json` and asserts on what gets written.

#### Test cases

**getTasks:**
- Returns empty array when config has no `tasks` field
- Returns tasks array when config has tasks
- Returns empty array when config file not found (readProjectConfig returns null)

**getOpenTasks:**
- Returns only tasks where `done === false`
- Returns empty array when all tasks are done

**addTask:**
- Adds task with ID 1 to a project with no existing tasks
- Adds task with next sequential ID (existing IDs [1, 3] → new ID is 4)
- Sets `createdAt` to current timestamp (use fake timers)
- Includes `dueDate` when provided
- Omits `dueDate` when not provided
- Throws GrindUserError when project config not found

**completeTask:**
- Sets `done = true` on the target task
- Sets `completedAt` to current timestamp (use fake timers)
- Does not modify other tasks
- Throws GrindUserError when task ID not found
- Throws GrindUserError when project config not found

**getTaskUrgency:**
- Returns `"overdue"` when any task is past due
- Returns `"overdue"` when any task is due today and another is past due (most urgent wins)
- Returns `"today"` when a task is due today but none are overdue
- Returns `"soon"` when tasks are due within 3 days but none today/overdue
- Returns `"none"` when all tasks are 4+ days out or have no due date
- Returns `"none"` for empty task list
- Ignores completed tasks

## Dependencies

- `src/types/index.ts` — `Task` interface (spec 1)
- `src/utils/config.ts` — `readProjectConfig`, `writeProjectConfig`
- `src/utils/errors.ts` — `GrindUserError`

## Verification

```bash
bun run test -- tests/utils/task.test.ts
bun run typecheck
```
