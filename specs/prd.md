# PRD: Grind Tasks

## Overview

Add a native task/todo system to Grind, scoped to projects and stored in `.project.json`. This replaces external tools like TaskWarrior and GitHub/GitLab issues for personal task management.

## Motivation

The user manages projects in Grind and currently relies on TaskWarrior and GH/GL issues for task tracking. This creates context-switching overhead. A native task system integrated into Grind provides a single dashboard (`grind status`) for everything: projects, time, and tasks.

## Commands

### `grind tasks`

List open tasks across all projects that have open tasks. Includes project name after the ID.

```
  #  Project          Task                          Due
  ──────────────────────────────────────────────────────
  1  my-blog          Fix the login bug              Jul 20
  2  my-blog          Write README section          Jul 25
  3  cool-webapp      Refactor auth module          Jul 30
```

Flags:
- `-a`, `--all` — include completed tasks

### `grind tasks <project>`

List open tasks for a specific project.

```
  #  Task                          Due
  ─────────────────────────────────────
  1  Fix the login bug              Jul 20
  2  Write README section          Jul 25
  3  Refactor auth module          Jul 30
  4  Update CI config
```

Flags:
- `-a`, `--all` — include completed tasks

### `grind tasks <project> add "description"`

Add a task to a project. ID is assigned sequentially (next available number).

```
grind tasks my-blog add "Fix the login bug"
grind tasks my-blog add "Fix the login bug" -d tomorrow
grind tasks my-blog add "Fix the login bug" --due 0720
```

Flags:
- `-d`, `--due <date>` — optional due date (see Date Formats below)

### `grind tasks <project> done <id>`

Mark a task as complete. Sets `done: true` and `completedAt` to current timestamp. The project name is required because task IDs are per-project and not globally unique.

```
grind tasks my-blog done 3
# Output: ✓ Task 3 completed
```

## Date Formats

The `-d`/`--due` flag supports flexible date input:

### Relative dates
| Input | Meaning |
|-------|---------|
| `today` | Today |
| `tomorrow` | Tomorrow |
| `3d` or `3days` | 3 days from now |
| `1w` or `1week` | 1 week from now |

### Absolute dates
| Input | Meaning |
|-------|---------|
| `0720` | July 20 of current year (MMDD) |
| `072026` | July 20, 2026 (MMDDYY) |
| `20260720` | July 20, 2026 (YYYYMMDD) |
| `2026-07-20` | July 20, 2026 (ISO standard) |

All dates are normalized to ISO date strings (`YYYY-MM-DD`) for storage.

## Data Model

Tasks are stored in `.project.json` as a `tasks` array:

```json
{
  "name": "my-blog",
  "type": "blog",
  "tasks": [
    {
      "id": 1,
      "description": "Fix the login bug",
      "done": false,
      "createdAt": "2026-07-14T10:00:00Z"
    },
    {
      "id": 2,
      "description": "Write README section",
      "done": false,
      "createdAt": "2026-07-14T11:00:00Z",
      "dueDate": "2026-07-25"
    },
    {
      "id": 3,
      "description": "Refactor auth module",
      "done": true,
      "createdAt": "2026-07-10T09:00:00Z",
      "completedAt": "2026-07-15T14:00:00Z",
      "dueDate": "2026-07-18"
    }
  ],
  "time": [...]
}
```

### TypeScript interface

```typescript
interface Task {
  id: number
  description: string
  done: boolean
  createdAt: string       // ISO timestamp
  completedAt?: string    // ISO timestamp, set when done=true
  dueDate?: string        // ISO date (YYYY-MM-DD)
}
```

### Rules

- **IDs are sequential and persistent** — task IDs never change or get reused, even after completion or removal
- **IDs are per-project** — task 1 in project A is unrelated to task 1 in project B. The `done` command requires both project name and ID to uniquely identify a task
- **No "undone" command** — user edits `.project.json` directly if a task was marked done by mistake
- **No delete command** — tasks are completed via `done`, not removed. If truly unwanted, user edits `.project.json` directly

## Display

### Task listing

- Sorted by due date soonest first; tasks with no due date appear at the bottom
- Color coding for due dates:
  - **Red**: overdue or due today
  - **Yellow**: due within 3 days
  - **Green**: due in 4+ days
  - **Plain**: no due date
- Completed tasks (when `-a` is used): shown with strikethrough or dimmed text

### Empty states

- `grind tasks <project>` with no tasks: `"No open tasks. Add one with: grind tasks <project> add \"My task\""`
- `grind tasks` with no tasks across all projects: `"All caught up! No open tasks."`

## Integration with `grind status`

The `grind status` output is updated to include a Tasks column, replacing the Issues column.

### Columns removed

- `Started` — niche, not actionable for daily workflow
- `Commits` — redundant with Last Commit
- `Issues` — replaced by native tasks

### Columns kept

- `Project`, `Worked`, `Billed`, `Last Session`, `Last Commit`

### New column

- `Tasks` — shows open task count per project, color-coded:
  - **Red**: has overdue tasks
  - **Yellow**: has tasks due today
  - **Plain**: no urgent tasks (or no tasks)
- Projects with 0 open tasks show `0` in plain text

### Updated status output format

```
Project          Worked  Billed  Tasks  Last Session  Last Commit
──────────────────────────────────────────────────────────────────
★ my-blog         2.5h    1.0h      3   2 days ago   today
  cool-webapp     1.0h    0.5h      1   3 weeks ago  2 days ago
  old-thing       0.0h    0.0h      0   never        never
```

## Out of Scope (v1)

- Mark a task undone (edit `.project.json` directly)
- Delete a task (edit `.project.json` directly)
- Edit task description
- Task priorities or labels
- Task dependencies
- Recurring tasks
- Estimates
- Time tracking per task (linking sessions to tasks)
- Burndown charts or analytics
