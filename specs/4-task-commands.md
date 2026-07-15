# Spec: Task Commands + Status Integration

## Goal

Implement the `grind tasks` command group and update `grind status` to show a Tasks column instead of Issues. This is the user-facing layer that depends on specs 1–3.

## Files to create/modify

- `src/commands/tasks.ts` — new command file
- `src/commands/status.ts` — modify to replace Issues with Tasks
- `src/utils/colors.ts` — add `YELLOW` color constant
- `src/index.ts` — register the `tasks` command
- `tests/commands/tasks.test.ts` — command tests
- `tests/commands/status.test.ts` — status integration tests (or update existing snapshot tests)

## Changes

### 1. Add `YELLOW` to `src/utils/colors.ts`

```typescript
export const YELLOW = "\x1b[33m";
```

### 2. Create `src/commands/tasks.ts`

Four exported functions, one per command variant:

```typescript
export async function listAllTasks(options: { all?: boolean }): Promise<void>
export async function listProjectTasks(project: string, options: { all?: boolean }): Promise<void>
export async function addTaskToProject(project: string, description: string, options: { due?: string }): Promise<void>
export async function completeProjectTask(project: string, taskId: string): Promise<void>
```

#### `listAllTasks` — `grind tasks [-a]`

1. Call `requireWorkspace()` to get `workspaceRoot`
2. Call `collectProjects(workspaceRoot)` to get all projects
3. For each project with a config, call `getOpenTasks()` (or `getTasks()` if `-a`)
4. Flatten into a single list, each item tagged with project name
5. Sort by due date soonest first; no due date at bottom
6. Print table with columns: `#`, `Project`, `Task`, `Due`
7. Color-code the `Due` column:
   - **RED** (`RED`): overdue or due today
   - **YELLOW** (`YELLOW`): due within 3 days
   - **GREEN** (`GREEN`): due in 4+ days
   - Plain: no due date
8. Completed tasks (when `-a`): print with `DIM` color (dimmed text)
9. Empty state: `"All caught up! No open tasks."`

#### `listProjectTasks` — `grind tasks <project> [-a]`

1. Call `requireWorkspace()` to get `workspaceRoot`
2. Validate project exists (call `readProjectConfig`, throw `GrindUserError` if null)
3. Call `getOpenTasks()` (or `getTasks()` if `-a`)
4. Sort and display same as above, but without the `Project` column
5. Empty state: `"No open tasks. Add one with: grind tasks <project> add \"My task\""`

#### `addTaskToProject` — `grind tasks <project> add "description" [-d <date>]`

1. Call `requireWorkspace()` to get `workspaceRoot`
2. Validate project exists
3. If `--due` provided, parse it with `parseDate()` from `src/utils/dates.ts`
4. Call `addTask()` from `src/utils/task.ts`
5. Print confirmation: `"✓ Task {id} added: {description}"`

#### `completeProjectTask` — `grind tasks <project> done <id>`

1. Call `requireWorkspace()` to get `workspaceRoot`
2. Validate project exists
3. Parse `id` as integer (throw `GrindUserError` if not a valid number)
4. Call `completeTask()` from `src/utils/task.ts`
5. Print confirmation: `"✓ Task {id} completed"`

### 3. Update `src/commands/status.ts`

#### Remove

- `getIssueCount()` function entirely
- `issues` and `commits` fields from `ProjectRow` interface
- `startDate` field from `ProjectRow` interface
- The git queries for `getCommitCount`, `getFirstCommitDate`, `getIssueCount` from the `Promise.all`
- `startDate`, `issues`, `commits` from column width calculations, header, divider, and row rendering

#### Add

- Import `getOpenTasks`, `getTaskUrgency` from `src/utils/task.ts`
- Import `YELLOW` from `src/utils/colors.ts`

- New field in `ProjectRow`:
  ```typescript
  taskCount: number;
  taskUrgency: "overdue" | "today" | "soon" | "none";
  ```

- In the `Promise.all` for each project, add:
  ```typescript
  const openTasks = await getOpenTasks(workspaceRoot, name);
  const taskCount = openTasks.length;
  const taskUrgency = getTaskUrgency(openTasks);
  ```

- Column width for `tasks`: `Math.max("Tasks".length, ...rows.map(r => String(r.taskCount).length))`

- Header becomes: `Project  Worked  Billed  Tasks  Last Session  Last Commit`
- Divider adjusts to 5 columns

- Task count display with color:
  - `RED` if `taskUrgency === "overdue"`
  - `YELLOW` if `taskUrgency === "today"`
  - Plain otherwise

- Row rendering: replace `issues` and `commits` pads with single `tasks` pad

#### Updated output format

```
  Project          Worked  Billed  Tasks  Last Session  Last Commit
  ─────────────────────────────────────────────────────────────────
  ★ my-blog         2.5h    1.0h      3   2 days ago   today
    cool-webapp     1.0h    0.5h      1   3 weeks ago  2 days ago
    old-thing       0.0h    0.0h      0   never        never
```

### 4. Register commands in `src/index.ts`

```typescript
import { listAllTasks, listProjectTasks, addTaskToProject, completeProjectTask } from "./commands/tasks.js";
```

```typescript
// grind tasks [project] [action] [args]
const tasksCmd = program
  .command("tasks [project]")
  .description("List or manage tasks")
  .option("-a, --all", "Include completed tasks");

tasksCmd.action(async (project: string | undefined, options: { all?: boolean }) => {
  if (project) {
    await listProjectTasks(project, options);
  } else {
    await listAllTasks(options);
  }
});

tasksCmd
  .command("add <project> <description>")
  .description("Add a task to a project")
  .option("-d, --due <date>", "Due date")
  .action(async (project: string, description: string, options: { due?: string }) => {
    await addTaskToProject(project, description, options);
  });

tasksCmd
  .command("done <project> <id>")
  .description("Mark a task as complete")
  .action(async (project: string, id: string) => {
    await completeProjectTask(project, id);
  });
```

**Note on Commander.js subcommand parsing:** The `tasks [project]` command with subcommands `add` and `done` needs careful Commander.js wiring. The `project` argument is positional and `add`/`done` are subcommands. If Commander has trouble disambiguating `grind tasks my-blog add "Fix bug"`, we may need to restructure as:

```typescript
// Alternative: flat subcommands under tasks
program.command("tasks").description("List tasks across all projects")
  .option("-a, --all", "Include completed tasks")
  .action(async (options) => { await listAllTasks(options); });

program.command("tasks-all").description("..."); // not ideal

// Better: use Commander's argument parsing
// grind tasks my-blog          → list project tasks
// grind tasks my-blog add "x"  → add task
// grind tasks my-blog done 3   → done task
```

Test this during implementation. If Commander can't parse `tasks <project> add <desc>`, restructure as separate top-level subcommands under a `tasks` command group (similar to how `new` works with `new idea`, `new project`, etc.).

### 5. Tests

#### `tests/commands/tasks.test.ts`

Mock `node:fs/promises` and the workspace/git utilities. Test the command functions directly.

**listAllTasks:**
- Prints table with tasks from multiple projects
- Sorts by due date (soonest first), no-due-date at bottom
- Shows project name column
- `-a` flag includes completed tasks (dimmed)
- Empty state message when no tasks exist

**listProjectTasks:**
- Prints table with tasks for one project
- No project name column
- `-a` flag includes completed tasks
- Empty state message with add hint
- Throws GrindUserError for nonexistent project

**addTaskToProject:**
- Adds task with due date (verify parseDate called, verify write)
- Adds task without due date
- Throws for invalid date format

**completeProjectTask:**
- Marks task done, sets completedAt
- Throws for non-numeric ID
- Throws for nonexistent task ID

#### `tests/commands/status.test.ts` (update or create)

- Snapshot test of status output with projects that have tasks
- Verify Tasks column appears with correct counts
- Verify color coding (overdue → red, today → yellow)
- Verify old Issues/Commits/Started columns are gone

## Dependencies

- Spec 1: `Task` interface
- Spec 2: `parseDate()` from `src/utils/dates.ts`
- Spec 3: `addTask()`, `completeTask()`, `getOpenTasks()`, `getTaskUrgency()` from `src/utils/task.ts`
- Existing: `requireWorkspace()`, `collectProjects()`, `readProjectConfig()`, color constants

## Verification

```bash
bun run test
bun run typecheck
bun run build
# Manual smoke test:
# grind tasks
# grind tasks <project>
# grind tasks <project> add "Test task" -d tomorrow
# grind tasks <project> done 1
# grind status
```
