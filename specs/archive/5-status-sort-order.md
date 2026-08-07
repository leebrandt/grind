# Spec: Status Sort Order by Hours Worked

## Goal

Change `grind status` to sort projects by total hours worked (most → least) instead of last session date. The projects you spend the most time on bubble to the top.

## Files to modify

- `src/commands/status.ts` — change sort logic

## Changes

### 1. Replace `sortKey` with `totalSeconds` in `ProjectRow`

Remove `sortKey: number` from the `ProjectRow` interface. Add `totalSeconds: number`:

```typescript
interface ProjectRow {
  name: string;
  hoursWorked: string;
  hoursBilled: string;
  taskCount: number;
  taskUrgency: "overdue" | "today" | "soon" | "none";
  lastSession: string;
  lastCommit: string;
  isActive: boolean;
  isDeadlineSoon: boolean;
  hasUnbilled: boolean;
  longTerm: boolean;
  totalSeconds: number;  // replaces sortKey
}
```

### 2. Update row construction

In the `rowPromises` map, compute `totalSeconds` directly from `config.time`:

```typescript
const totalSeconds = config.time.reduce((sum, s) => sum + s.rounded, 0);
```

Set it on the returned row object. Remove the `sortKey` computation:

```typescript
// Remove this:
const sortKey = lastSessionDate ? new Date(lastSessionDate).getTime() : 0;
```

### 3. Replace sort logic

Current sort (by last session date, oldest first):

```typescript
rows.sort((a, b) => {
  if (a.sortKey === 0 && b.sortKey === 0) return a.name.localeCompare(b.name);
  if (a.sortKey === 0) return -1;
  if (b.sortKey === 0) return 1;
  return a.sortKey - b.sortKey;
});
```

New sort (by total seconds worked, descending):

```typescript
rows.sort((a, b) => {
  if (a.totalSeconds === b.totalSeconds) return a.name.localeCompare(b.name);
  return b.totalSeconds - a.totalSeconds;
});
```

Projects with equal hours sort alphabetically. No special handling for zero-hours projects — they fall to the bottom naturally.

## Output example

```
  Project          Worked  Billed  Tasks  Last Session  Last Commit
  ─────────────────────────────────────────────────────────────────
  ★ my-blog         2.5h    1.0h      3   2 days ago   today
    cool-webapp     1.0h    0.5h      1   3 weeks ago  2 days ago
    old-thing       0.0h    0.0h      0   never        never
```

`my-blog` appears first because 2.5h > 1.0h, regardless of when each was last touched.

## Tests

Update `tests/commands/status.test.ts`:

**New test cases:**

- **Sort order by hours worked**: Three projects with 5h, 2h, 8h of tracked time — verify output order is 8h, 5h, 2h
- **Equal hours tiebreak**: Two projects with identical hours — verify alphabetical by name
- **Zero hours projects at bottom**: One project with 5h, one with 0h — verify 5h appears first
- **No last-session dependency**: A project with 10h worked but no recent session appears before a project with 1h worked and a session from yesterday

**Existing tests:** Color priority, formatting, and edge case tests remain valid since they operate on individual rows, not ordering. No changes needed to those tests.

## Dependencies

- None (only touches `src/commands/status.ts` internal sort and row shape)

## Verification

```bash
bun run test -- tests/commands/status.test.ts
bun run typecheck
```
