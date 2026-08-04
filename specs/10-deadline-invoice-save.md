# Spec: Deadline States, Invoice Terms, Save `-t` Warning

Covers **PRD Fixes 4-6** — three independent command-level correctness fixes.

## Goal

1. **Deadline states (Fix 4):** `grind status` flags expired deadlines red forever — a deadline passed weeks ago has a negative `diffDays` and matches `isDeadlineSoon = diffDays <= 7`. Introduce three states: **overdue** (diff < 0) → RED, **soon** (0 ≤ diff ≤ 7) → YELLOW, else no deadline color. **This changes visible behavior:** "deadline within 7 days" projects go from RED to YELLOW (confirmed in the PRD interview).
2. **Invoice due date (Fix 5):** `invoice.ts:81` hardcodes `+30 days` regardless of configured `paymentTerms` ("Net 7" still yields a 30-day due date). Parse the terms.
3. **`save -t` (Fix 6):** `save -t <hours>` is silently dropped when no session is active. Print a warning and continue (non-fatal — do not block save/commit/push).

## Files to modify

- `src/commands/status.ts` — three deadline states + color priority
- `src/commands/invoice.ts` — `daysFromPaymentTerms()` helper, use at line 81
- `src/commands/save.ts` — `-t` warning
- Tests: `tests/commands/status.test.ts` (update RED→YELLOW assertions + new cases), `tests/commands/invoice.test.ts` (new), `tests/commands/save.test.ts`

## Changes

### 1. `src/commands/status.ts` — deadline states

Add to `ProjectRow` (line 16):

```typescript
isDeadlineOverdue: boolean;
```

Deadline block (lines 65-72):

```typescript
const now = new Date();
let isDeadlineOverdue = false;
let isDeadlineSoon = false;
if (config.deadline) {
  const deadline = new Date(config.deadline + "T23:59:59Z");
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  isDeadlineOverdue = diffDays < 0;
  isDeadlineSoon = diffDays >= 0 && diffDays <= 7;
}
```

Add `isDeadlineOverdue` to the returned row object.

Name-color priority (lines 113-122) — `isActive` (GREEN) > `isDeadlineOverdue` (RED) > `isDeadlineSoon` (YELLOW) > `hasUnbilled` (YELLOW) > WHITE:

```typescript
if (row.isActive) {
  nameColor = GREEN;
} else if (row.isDeadlineOverdue) {
  nameColor = RED;
} else if (row.isDeadlineSoon) {
  nameColor = YELLOW;
} else if (row.hasUnbilled) {
  nameColor = YELLOW;
} else {
  nameColor = WHITE;
}
```

(`isDeadlineSoon` and `hasUnbilled` both render YELLOW, so their relative order has no visible effect — keep it as specified.)

### 2. `src/commands/invoice.ts` — `daysFromPaymentTerms`

Add an exported pure helper near the top of the file (after imports):

```typescript
/**
 * Map a payment-terms string to the number of days until the invoice is due.
 * "Net 30" → 30, "net 7" → 7, "Due on receipt" → 0, anything else → 30.
 */
export function daysFromPaymentTerms(terms: string): number {
  const netMatch = /^net\s+(\d+)$/i.exec(terms.trim());
  if (netMatch) return parseInt(netMatch[1], 10);
  if (/due on receipt/i.test(terms)) return 0;
  return 30;
}
```

Replace line 81:

```typescript
const dueDate = formatDate(
  new Date(now.getTime() + daysFromPaymentTerms(paymentTerms) * 24 * 60 * 60 * 1000).toISOString(),
);
```

The `dueDate` is computed once and passed into both the markdown and `generateInvoicePDFBuffer`, so one fix covers both paths. `paymentTerms` is `grindConfig.paymentTerms ?? "Net 30"`, so the helper always receives a string.

### 3. `src/commands/save.ts` — warn when `-t` can't backfill

In the `else` branch (no `endedSession`, lines 76-78), when `-t` was provided:

```typescript
} else {
  if (options?.time) {
    console.log(
      `Warning: -t ${options.time} ignored — no active session found to backfill for '${projectName}'.`,
    );
  }
  console.log("No active sessions found.");
}
```

Notes:
- `options?.time` here is known to be a valid positive number — an invalid value already throws at lines 53-57 — so reaching this branch with `-t` set means there was simply no active session.
- The PRD's message template shows `<hours>` as a placeholder; substitute the user-supplied value (shown above).
- Warning is non-fatal: save/commit/push proceed exactly as before.

## Tests

### `tests/commands/status.test.ts` — update + add

**Existing tests that must change** (they assert RED for "soon" deadlines; the fix makes those YELLOW):

- `"red when deadline within 7 days and no active session"` (line 95) → assert `YELLOW`, rename to "yellow when deadline within 7 days"
- `"deadline within 7 days + unbilled → red (deadline beats unbilled)"` (line 214) → assert `YELLOW` (both states are yellow now), rename
- `"deadline exactly 7 days away → red"` (line 263) → assert `YELLOW`

**Tests that stay green as-is:** overdue → RED (lines 116, 299), active + deadline → GREEN (line 177), 8 days away → not red (line 281), no deadline → not red (line 248).

**New tests:**

- deadline 2 days ago → RED, and the row's deadline renders as overdue (same RED assertion covers it)
- deadline in 3 days → YELLOW
- deadline in 10 days → no deadline color (falls through to YELLOW-if-unbilled / WHITE); assert not RED and not YELLOW-when-invoiced, or assert `WHITE` with an invoiced session
- **active project stays GREEN even when overdue** (deadline in the past + active session → GREEN)

The existing edge-case block freezes time with `jest.setSystemTime(new Date("2026-07-17T12:00:00Z"))` — reuse that pattern for the new cases (2026-07-15 → overdue, 2026-07-20 → soon, 2026-07-27 → none).

### `tests/commands/invoice.test.ts` (new) — pure helper tests

```typescript
import { daysFromPaymentTerms } from "../../src/commands/invoice.js";

describe("daysFromPaymentTerms", () => {
  it("parses Net terms", () => {
    expect(daysFromPaymentTerms("Net 30")).toBe(30);
    expect(daysFromPaymentTerms("Net 7")).toBe(7);
    expect(daysFromPaymentTerms("net 15")).toBe(15);
  });
  it("returns 0 for due on receipt", () => {
    expect(daysFromPaymentTerms("Due on receipt")).toBe(0);
    expect(daysFromPaymentTerms("due on receipt")).toBe(0);
  });
  it("falls back to 30 for anything else", () => {
    expect(daysFromPaymentTerms("weird")).toBe(30);
    expect(daysFromPaymentTerms("")).toBe(30);
  });
});
```

(The markdown/PDF due-date rendering is covered by the manual smoke test below.)

### `tests/commands/save.test.ts`

Add to the `backfill time (-t flag)` describe (existing mock setup already routes `mockGetActiveSession` → `null` and `mockEndSession` → `undefined`):

- with `-t 1` and no active session, output contains the warning (assert `console.log` called with a string containing `ignored — no active session found to backfill for 'test-project'`), and the command still reaches commit/push (assert `mockGitCommit`/`mockGitCommitInteractive` and `mockPushWorkspace` were called)
- without `-t`, no warning is printed (assert no log call contains "ignored")
- the existing test `"should still save when -t is given but no active session"` (line 129) can absorb the warning assertion or remain as-is

## Dependencies

- Specs 7-9 (independent; no ordering constraint)
- **Overlaps with Spec 8 and Spec 11** via shared files:
  - `status.ts` also touched by Spec 8 (different section — commit-count call vs deadline block)
  - `invoice.ts` also touched by Spec 11 (different line — 81 vs 189)
  - Sequential implementation avoids any merge care; if parallel, note the overlap.

## Verification

```bash
bun run typecheck
bun run test -- tests/commands/status.test.ts tests/commands/invoice.test.ts tests/commands/save.test.ts

# Manual smoke tests:
grind status              # deadline 2 days ago → red; in 3 days → yellow; 10 days → plain
grind invoice <project>   # with paymentTerms "Net 7" configured → 7-day due date in markdown AND pdf
grind save <project> -t 1 # no active session → warning printed, commit/push proceeds
```
