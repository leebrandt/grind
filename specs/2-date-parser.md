# Spec: Date Parser

## Goal

Create a utility that parses flexible date input strings (relative and absolute) into normalized ISO date strings (`YYYY-MM-DD`). Used by the `tasks add --due` command.

## Files to create

- `src/utils/dates.ts` — date parsing utility
- `tests/utils/dates.test.ts` — tests

## Changes

### 1. Create `src/utils/dates.ts`

Export a single function:

```typescript
export function parseDate(input: string, now?: Date): string
```

The optional `now` parameter is for testability (defaults to `new Date()`). Returns an ISO date string `YYYY-MM-DD`. Throws `GrindUserError` for unparseable input.

#### Supported formats

**Relative dates:**
| Input | Meaning |
|-------|---------|
| `today` | Today |
| `tomorrow` | Tomorrow |
| `3d` or `3days` | 3 days from now |
| `1w` or `1week` | 1 week from now |

**Absolute dates:**
| Input | Meaning |
|-------|---------|
| `0720` | July 20 of current year (MMDD) |
| `072026` | July 20, 2026 (MMDDYY) |
| `20260720` | July 20, 2026 (YYYYMMDD) |
| `2026-07-20` | July 20, 2026 (ISO standard) |

#### Implementation approach

1. Trim and lowercase the input
2. Check relative patterns first (`today`, `tomorrow`, `\d+d(ays?)?`, `\d+w(eeks?)?`)
3. Check absolute patterns in order of specificity: `YYYY-MM-DD`, `YYYYMMDD`, `MMDDYY`, `MMDD`
4. For MMDD and MMDDYY, use the current year (or extracted year) to construct the date
5. Validate the resulting date (e.g., month 13 or day 32 should throw)
6. Return `YYYY-MM-DD` string

Use `Date` constructor for arithmetic on relative dates. Use manual parsing for absolute dates to avoid timezone issues.

### 2. Create `tests/utils/dates.test.ts`

Tests use `jest.useFakeTimers()` / `jest.setSystemTime()` to control "now" (set to `2026-07-15T12:00:00Z`).

#### Test cases

**Relative — today/tomorrow:**
- `"today"` → `"2026-07-15"`
- `"tomorrow"` → `"2026-07-16"`

**Relative — days:**
- `"3d"` → `"2026-07-18"`
- `"3days"` → `"2026-07-18"`
- `"1d"` → `"2026-07-16"`

**Relative — weeks:**
- `"1w"` → `"2026-07-22"`
- `"1week"` → `"2026-07-22"`
- `"2w"` → `"2026-07-29"`

**Absolute — MMDD:**
- `"0720"` → `"2026-07-20"`
- `"1225"` → `"2026-12-25"`
- `"0101"` → `"2026-01-01"`

**Absolute — MMDDYY:**
- `"072026"` → `"2026-07-20"`
- `"122525"` → `"2025-12-25"`

**Absolute — YYYYMMDD:**
- `"20260720"` → `"2026-07-20"`

**Absolute — ISO:**
- `"2026-07-20"` → `"2026-07-20"`

**Error cases (throw GrindUserError):**
- `"banana"` — unparseable
- `"1340"` — invalid month (13)
- `"0230"` — invalid day for Feb (in non-leap year)
- `""` — empty string

**Case insensitivity:**
- `"Tomorrow"` → `"2026-07-16"`
- `"3DAYS"` → `"2026-07-18"`

**Leading/trailing whitespace:**
- `" tomorrow "` → `"2026-07-16"`

## Dependencies

- `src/utils/errors.ts` — `GrindUserError` for bad input

## Verification

```bash
bun run test -- tests/utils/dates.test.ts
bun run typecheck
```
