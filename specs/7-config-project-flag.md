# Spec: Config `-p`/`--project` Alias

Covers **PRD Fix 1** in `specs/prd-hardening.md`.

## Goal

Make every documented `grind config` invocation work by adding the `-p, --project <name>` flag as an alias for the positional `[project]` argument. Three places already tell users to use `-p` (README.md:130-132, `src/commands/work.ts:43`, `src/commands/new.ts:209`), but the flag does not exist — users hit Commander's `error: unknown option '-p'`. The fix is to add the flag, not to change those references; all existing docs and error messages become valid once the flag exists.

No user-facing behavior is added beyond the alias itself.

## Files to modify

- `src/commands/config.ts` — add + export `resolveProjectArg()`; update usage comment
- `src/index.ts` — register the `-p` option; use `resolveProjectArg()` in the action handler
- `tests/commands/config.test.ts` — tests for `resolveProjectArg()`

## Changes

### 1. Add `resolveProjectArg()` to `src/commands/config.ts`

Add near the top of the file (after the `ConfigOptions` interface) and export it so it is unit-testable:

```typescript
/**
 * Resolve the project name from the positional [project] arg, the -p/--project
 * flag, or neither. Throws when the forms conflict or when -p is combined with -g.
 */
export function resolveProjectArg(
  positional: string | undefined,
  flag: string | undefined,
  isGlobal: boolean,
): string | undefined {
  if (isGlobal && flag) {
    throw new GrindUserError("Cannot use -p/--project with -g/--global");
  }
  if (positional && flag && positional !== flag) {
    throw new GrindUserError(
      `Project specified twice: "${positional}" (positional) and "${flag}" (-p/--project). Use only one form.`,
    );
  }
  return flag ?? positional;
}
```

`GrindUserError` is already imported in this file (line 48).

### 2. Update the usage comment in `src/commands/config.ts` (lines 6-13)

Document the new flag:

```
 * grind config <project> <key> <value>    # Set project config
 * grind config -p <project> <key> <value> # Set project config (same as positional)
 * grind config <project> <key>            # Get project config
 * grind config -p <project> <key>         # Get project config (same as positional)
 * grind config <project> --list           # Show project config
 * grind config -p <project> --list        # Show project config (same as positional)
 * grind config -g <key> <value>           # Set workspace config
 * grind config -g <key>                   # Get workspace config
 * grind config -g --list                  # Show workspace config
```

### 3. Register the option in `src/index.ts` (config command, ~line 115)

Add to the `config` command registration, after the existing `-l, --list` option:

```typescript
.option("-p, --project <name>", "Project name (alternative to positional [project])")
```

### 4. Use `resolveProjectArg()` in the action handler (`src/index.ts` lines 154-182)

Import the helper:

```typescript
import { configList, configGet, configSet, resolveProjectArg } from "./commands/config.js";
```

Update the action handler so the resolved project name feeds the non-global branch, and the existing `"Project name is required"` error applies to the resolved value:

```typescript
.action(
  async (
    project: string | undefined,
    key: string | undefined,
    value: string | undefined,
    options: { global?: boolean; list?: boolean; project?: string },
  ) => {
    const resolvedProject = resolveProjectArg(project, options.project, options.global);

    if (options.global) {
      if (options.list || (!key && !value)) {
        await configList(null, options);
      } else if (key && !value) {
        await configGet(key, null, options);
      } else if (key && value) {
        await configSet(key, value, null, options);
      }
    } else {
      if (!resolvedProject) {
        throw new GrindError("Project name is required (or use -g for workspace config)", 1);
      }
      if (options.list || (!key && !value)) {
        await configList(resolvedProject, options);
      } else if (key && !value) {
        await configGet(key, resolvedProject, options);
      } else if (key && value) {
        await configSet(key, value, resolvedProject, options);
      }
    }
  },
);
```

Notes:
- `resolveProjectArg` runs in both branches, so `-p` + `-g` errors even when no key/value is given.
- No change to `configList`/`configGet`/`configSet` signatures — they already take `projectName: string | null`.
- No change to README lines 130-132 or the error messages in `work.ts`/`new.ts` — they become correct once the flag exists.
- `GrindError` is already imported in `index.ts`.

## Tests

Add a `describe("resolveProjectArg")` block to `tests/commands/config.test.ts` (pure function, no mocking needed):

- only positional → returns positional
- only `-p` flag → returns flag
- both set, same value → returns that value
- both set, different values → throws `GrindUserError`, message mentions both forms, `exitCode === 1`
- `-p` + `-g` → throws `GrindUserError` with "Cannot use -p/--project with -g/--global", `exitCode === 1`
- no project, not global → returns `undefined` (the `index.ts` handler raises "Project name is required")

## Dependencies

- `src/utils/errors.ts` — `GrindUserError`
- None of the other specs; this is the first spec in the batch (matches PRD priority order #1).

## Verification

```bash
bun run typecheck
bun run test -- tests/commands/config.test.ts

# Manual smoke tests:
grind config -p my-project repo git@github.com:owner/repo.git   # previously errored
grind config my-project repo git@github.com:owner/repo.git      # positional still works
grind config -p x -g billing.roundTo quarter-hour               # → error: -p with -g
```
