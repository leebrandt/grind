# Spec: Local-Timezone Date Strings

Covers **PRD Fix 3**.

## Goal

Make all "today"/date-string computations timezone-correct (local, not UTC). Today `getTaskUrgency` (`task.ts:74`), `getDueColor` (`tasks.ts:40`), and the journal filename (`journal.ts:21`) derive "today" via `new Date().toISOString().slice(0, 10)` — UTC. In a negative-UTC-offset timezone at 5pm local, a task due today compares against tomorrow's UTC date and shows green instead of red, and `grind journal` creates tomorrow's entry.

The fix introduces one pure helper, `toLocalDateString()`, used by all three call sites. The `diff <= 3` "soon" computation is unchanged: both operands are date-only strings parsed identically, so day diffs stay exact.

## Files to modify

- `src/utils/time.ts` — add `toLocalDateString()`
- `src/utils/task.ts` — `getTaskUrgency` uses it
- `src/commands/tasks.ts` — `getDueColor` uses it (and becomes exported for testing)
- `src/commands/journal.ts` — filename uses it
- Tests: `tests/utils/time.test.ts`, `tests/utils/task.test.ts`, `tests/commands/tasks.test.ts`, `tests/commands/journal.test.ts` (new)

## Changes

### 1. Add `toLocalDateString()` to `src/utils/time.ts`

```typescript
/**
 * Current (or given) date as a local-timezone YYYY-MM-DD string.
 * Unlike toISOString().slice(0, 10), this uses local getters, so the result
 * matches the user's clock, not UTC.
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

### 2. `src/utils/task.ts` — `getTaskUrgency` (line 72-74)

Import `toLocalDateString` from `./time.js` and replace the derivation:

```typescript
export function getTaskUrgency(tasks: Task[], now?: Date): "overdue" | "today" | "soon" | "none" {
  const today = now ?? new Date();
  const todayStr = toLocalDateString(today);
  ...
```

### 3. `src/commands/tasks.ts` — `getDueColor` (line 38)

Import `toLocalDateString` from `../utils/time.js`. Change the function to an **exported** pure helper (matching the codebase's "test the utility logic, not the glue" convention — the PRD requires a unit test with an injected `now`):

```typescript
export function getDueColor(dueDate: string | undefined, now: Date): string {
  if (!dueDate) return "";
  const todayStr = toLocalDateString(now);
  if (dueDate < todayStr) return RED;
  if (dueDate === todayStr) return RED;
  const diff = (new Date(dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 3) return YELLOW;
  return GREEN;
}
```

(The rest of the file, including `printTaskTable`, is unchanged.)

### 4. `src/commands/journal.ts` — filename (line 21)

```typescript
import { toLocalDateString } from "../utils/time.js";
...
const today = toLocalDateString(); // local YYYY-MM-DD
```

## Tests

### `tests/utils/time.test.ts` — `toLocalDateString` (pure, no mocking)

Primary tests use local-time constructors, which are deterministic in **any** TZ and prove the function is not using `toISOString` (in a UTC+ zone that would return the previous day):

- `toLocalDateString(new Date(2026, 0, 1))` → `"2026-01-01"` (month zero-padding)
- `toLocalDateString(new Date(2026, 6, 4))` → `"2026-07-04"`
- `toLocalDateString(new Date(2026, 11, 31))` → `"2026-12-31"`
- `toLocalDateString()` with `jest.useFakeTimers()` / `jest.setSystemTime(new Date(2026, 3, 9))` → `"2026-04-09"` (day zero-padding)

Timezone-edge test (optional but recommended — Node ≥ 16 on Linux honors a runtime `process.env.TZ` change for subsequent `Date` operations; restore it in `afterEach`):

```typescript
const prevTZ = process.env.TZ;
afterEach(() => { process.env.TZ = prevTZ; });

it("uses local date across a UTC-midnight boundary", () => {
  process.env.TZ = "America/Los_Angeles";            // UTC-7 in August
  expect(toLocalDateString(new Date("2026-08-03T00:30:00Z"))).toBe("2026-08-02");
  process.env.TZ = "UTC";
  expect(toLocalDateString(new Date("2026-08-03T00:30:00Z"))).toBe("2026-08-03");
});
```

If the runtime TZ change proves unreliable in the test environment, drop the TZ variant and keep the local-constructor tests (they still fail against a `toISOString`-based implementation in UTC+ CI zones).

### `tests/utils/task.test.ts` — `getTaskUrgency` with an injected `now` at the UTC-midnight edge

With `process.env.TZ = "America/Los_Angeles"` (restored in `afterEach`, alongside the existing `jest.useRealTimers()` call) and `now = new Date("2026-08-03T00:30:00Z")` (local 2026-08-02 17:30 → local today is `"2026-08-02"`):

- task due `"2026-08-02"` → `"today"` (old UTC code said `"overdue"`)
- task due `"2026-08-01"` → `"overdue"`
- task due `"2026-08-03"` → `"soon"` (1 day out; old UTC code said `"today"`)
- existing tests using `now = new Date("2026-06-15T12:00:00.000Z")` remain green — `toLocalDateString` of a midday-UTC instant equals its UTC date in most zones; if the suite runs in a UTC-offset zone where 12:00Z crosses midnight, re-anchor those tests to a local-noon instant via `new Date(2026, 5, 15, 12)`.

### `tests/commands/tasks.test.ts` — `getDueColor` with an injected `now` at the same edge

Import the now-exported `getDueColor` directly. With TZ=America/Los_Angeles and `now = new Date("2026-08-03T00:30:00Z")` (local today `"2026-08-02"`):

- `getDueColor("2026-08-02", now)` → `RED` (due today)
- `getDueColor("2026-08-03", now)` → `YELLOW` (1 day out — **this is the distinguishing assertion**: old UTC code returned RED because it compared against `"2026-08-03"`)
- `getDueColor("2026-08-05", now)` → `YELLOW` (3 days)
- `getDueColor("2026-08-06", now)` → `GREEN` (4+ days)
- `getDueColor(undefined, now)` → `""`

### `tests/commands/journal.test.ts` (new)

Mock `requireWorkspace` → `{ mainWorktree: "/w/grind" }`, mock `node:fs/promises` `mkdir`, and mock `../utils/editor.js`'s `openEditorDetached` (a `jest.fn().mockResolvedValue(undefined)`). With `jest.useFakeTimers()` + `jest.setSystemTime(new Date("2026-08-03T00:30:00Z"))` and TZ=America/Los_Angeles:

- `journal()` calls `openEditorDetached("/w/grind/journal/2026-08-02.md")` — the local date, not the UTC date `2026-08-03`

## Dependencies

- Spec 7/8 (independent)
- **Overlaps with Spec 11**: both edit `src/commands/journal.ts` — Spec 9 touches line 21 (filename), Spec 11 touches line 24 (`await`). Implement sequentially (either order; each edit is on a different line) or merge carefully if parallel.
- `src/utils/errors.ts` — not needed here (no new error paths).

## Verification

```bash
bun run typecheck
bun run test -- tests/utils/time.test.ts tests/utils/task.test.ts tests/commands/tasks.test.ts tests/commands/journal.test.ts

# Manual smoke test:
# In a UTC-offset timezone at the UTC-midnight edge:
grind tasks               # due-today task shows RED (not green)
grind journal             # opens today's file (local date)
```
