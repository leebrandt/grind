# Spec: Task Types

## Goal

Add the `Task` interface and extend `ProjectConfig` with a `tasks` array. This is the foundation that all other task specs depend on.

## Files to modify

- `src/types/index.ts` — add `Task` interface, add `tasks?: Task[]` to `ProjectConfig`

## Changes

### 1. Add `Task` interface (after `Session` interface, ~line 19)

```typescript
export interface Task {
  id: number;
  description: string;
  done: boolean;
  createdAt: string;       // ISO timestamp
  completedAt?: string;    // ISO timestamp, set when done=true
  dueDate?: string;        // ISO date (YYYY-MM-DD)
}
```

### 2. Extend `ProjectConfig` (line 67-81)

Add optional `tasks` field:

```typescript
export interface ProjectConfig {
  name: string;
  type?: string;
  idea: string;
  time: Session[];
  tasks?: Task[];           // <-- NEW
  billing: {
    roundTo: RoundTo;
    rate: number;
  };
  client?: ClientInfo;
  repo?: string;
  code?: string;
  longTerm?: boolean;
  publications?: { url: string; publishedAt: string }[];
}
```

`tasks` is optional so existing project configs without tasks continue to work.

## Tests

`tests/types/task.test.ts` — verify the `Task` interface compiles and can be constructed:

- A minimal task (id, description, done, createdAt) satisfies the interface
- A task with optional fields (completedAt, dueDate) satisfies the interface
- Existing `ProjectConfig` objects without `tasks` still satisfy the interface
- A `ProjectConfig` with a `tasks` array satisfies the interface

## Verification

```bash
bun run typecheck
bun run test
```
