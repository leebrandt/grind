# Spec: Long-Term Projects Sort Last in Status

## Goal

Change `grind status` to list long-term projects after all short-term projects. Within each group, keep the existing sort by total hours worked (most → least). This lets you see at a glance how many short-term things you have going on.

## Files to modify

- `src/commands/status.ts` — change sort logic

## Changes

### 1. Replace sort comparator

Current sort (by total hours only):

```typescript
rows.sort((a, b) => {
  if (a.totalSeconds === b.totalSeconds) return a.name.localeCompare(b.name);
  return b.totalSeconds - a.totalSeconds;
});
```

New sort (short-term first, then long-term, descending hours within each group):

```typescript
rows.sort((a, b) => {
  if (a.longTerm !== b.longTerm) return a.longTerm ? 1 : -1;
  if (a.totalSeconds === b.totalSeconds) return a.name.localeCompare(b.name);
  return b.totalSeconds - a.totalSeconds;
});
```

The only addition is the `longTerm` check at the top. Short-term projects (`longTerm: false`) always sort before long-term projects (`longTerm: true`). Within each group, the existing hours-descending + alphabetical-tiebreak logic applies unchanged.

No changes to `ProjectRow` interface, row construction, rendering, or column layout. The `longTerm` field already exists on `ProjectRow`.

## Output example

```
  Project          Worked  Billed  Tasks  Last Session  Last Commit
  ─────────────────────────────────────────────────────────────────
    cool-webapp     3.0h    1.5h      2   today        today
    side-hustle     1.0h    0.5h      0   3 days ago   1 week ago
  ★ my-blog         5.0h    2.0h      1   yesterday    yesterday
  ★ old-thing       2.5h    1.0h      0   1 month ago  2 weeks ago
```

Short-term projects (`cool-webapp`, `side-hustle`) appear first, sorted by hours. Long-term projects (`★ my-blog`, `★ old-thing`) appear last, also sorted by hours. The `★` prefix and color coding are unaffected.

## Tests

Update `tests/commands/status.test.ts`:

**New test cases:**

- **Long-term projects sort last**: One short-term project with 2h, one long-term project with 5h — verify short-term appears first despite fewer hours
- **Within-group sort preserved**: Two short-term projects (3h, 1h) and two long-term projects (4h, 2h) — verify order is: short-3h, short-1h, long-4h, long-2h
- **All short-term**: Multiple short-term projects — verify sort is unchanged (by hours descending)
- **All long-term**: Multiple long-term projects — verify sort is unchanged (by hours descending)
- **Mixed with equal hours**: Short-term and long-term projects with identical hours — verify short-term still appears first, alphabetical tiebreak within each group

**Existing tests:** Color priority, formatting, column alignment, and edge case tests remain valid. The sort change does not affect row content or rendering.

## Dependencies

- None (only changes the sort comparator in `src/commands/status.ts`)

## Verification

```bash
bun run test -- tests/commands/status.test.ts
bun run typecheck
```
