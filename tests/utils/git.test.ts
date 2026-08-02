// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs from "node:fs/promises";
import { getDefaultBranch, getFirstCommitDate, gitAddWorktree, gitCommit, pullWorkspace } from "../../src/utils/git.ts";
import type { GrindConfig } from "../../src/types/index.js";

jest.mock("bun");
jest.mock("node:fs/promises");

const mock$ = jest.requireMock("bun").$ as jest.Mock;

/**
 * Reconstruct the full shell command from a $ mock call (strings + interpolated values).
 */
function cmdOf(call: unknown[]): string {
  const parts = call[0] as string[];
  const values = call.slice(1);
  let cmd = "";
  for (let i = 0; i < parts.length; i++) {
    cmd += parts[i];
    if (i < values.length) cmd += String(values[i]);
  }
  return cmd;
}

/**
 * Mock the bun shell `$` so each command's output can be routed by substring.
 * Supports both `.quiet()` and `.quiet().nothrow()` chaining.
 */
function shellMock(routes: Record<string, { stdout?: string; exitCode?: number; reject?: boolean }>): void {
  mock$.mockImplementation((...args: unknown[]) => {
    const parts = args[0] as string[];
    const values = args.slice(1);
    let cmd = "";
    for (let i = 0; i < parts.length; i++) {
      cmd += parts[i];
      if (i < values.length) cmd += String(values[i]);
    }
    const route = Object.entries(routes).find(([needle]) => cmd.includes(needle))?.[1] ?? { stdout: "" };
    const out = { stdout: Buffer.from(route.stdout ?? ""), exitCode: route.exitCode ?? 0 };
    const promise = route.reject ? Promise.reject(new Error("command failed")) : Promise.resolve(out);
    (promise as Promise<typeof out> & { nothrow: unknown }).nothrow = jest.fn().mockResolvedValue(out);
    if (route.reject) {
      // Mark handled so an unused rejection doesn't crash the worker when .nothrow() is used.
      promise.catch(() => {});
    }
    return { quiet: jest.fn().mockReturnValue(promise) };
  });
}

describe("getDefaultBranch", () => {
  const bareRepoPath = "/fake/repo.git";

  beforeEach(() => {
    jest.clearAllMocks();
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({ stdout: Buffer.from("") }),
    }));
  });

  it("returns config value when set", async () => {
    const config: GrindConfig = {
      billing: { roundTo: "quarter-hour", defaultRate: 150 },
      defaultBranch: "trunk",
    };
    const result = await getDefaultBranch(bareRepoPath, config);
    expect(result).toBe("trunk");
  });

  it("falls back to detected branch from git symbolic-ref", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from("refs/heads/develop\n"),
      }),
    }));
    const result = await getDefaultBranch(bareRepoPath);
    expect(result).toBe("develop");
  });

  it("falls back to main when neither config nor symbolic-ref is available", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockRejectedValue(new Error("not a git repository")),
    }));
    const result = await getDefaultBranch(bareRepoPath);
    expect(result).toBe("main");
  });

  it("prioritizes config over git symbolic-ref", async () => {
    const config: GrindConfig = {
      billing: { roundTo: "quarter-hour", defaultRate: 150 },
      defaultBranch: "primary",
    };
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from("refs/heads/main\n"),
      }),
    }));
    const result = await getDefaultBranch(bareRepoPath, config);
    expect(result).toBe("primary");
  });
});

describe("getFirstCommitDate", () => {
  const repoPath = "/fake/repo.git";
  const branch = "my-project";

  beforeEach(() => {
    jest.clearAllMocks();
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({ stdout: Buffer.from("") }),
    }));
  });

  it("returns null when no project-specific commits exist", async () => {
    const result = await getFirstCommitDate(repoPath, branch);
    expect(result).toBeNull();
  });

  it("returns the first commit date when project-specific commits exist", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from("2026-06-01T10:00:00+00:00\n2026-06-02T12:00:00+00:00\n"),
      }),
    }));

    const result = await getFirstCommitDate(repoPath, branch);
    expect(result).toBe("2026-06-01T10:00:00+00:00");
  });

  it("returns null on git error", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockRejectedValue(new Error("git error")),
    }));

    const result = await getFirstCommitDate(repoPath, branch);
    expect(result).toBeNull();
  });

  it("excludes commits already on main when finding the first commit date", async () => {
    await getFirstCommitDate(repoPath, branch);

    const templateStrings = mock$.mock.calls[0][0] as string[];
    expect(templateStrings.join("")).toContain("--not main");
  });
});

describe("gitCommit", () => {
  const worktreePath = "/fake/worktree";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses to commit when there are unmerged paths", async () => {
    shellMock({
      "ls-files -u": { stdout: "100644 abc 1\tprojects/x/.project.json\n" },
    });

    await expect(gitCommit(worktreePath, "msg")).rejects.toThrow("unmerged");
    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("commit -m"))).toBe(false);
  });

  it("commits when no unmerged paths exist", async () => {
    shellMock({ "ls-files -u": { stdout: "" } });

    await expect(gitCommit(worktreePath, "msg")).resolves.toBeUndefined();
    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("commit -m"))).toBe(true);
  });
});

describe("gitAddWorktree", () => {
  const repoPath = "/fake/repo.git";
  const wtPath = "/fake/worktree";
  const branch = "my-project";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates the worktree from origin/<branch> when the local branch is missing", async () => {
    shellMock({
      "rev-parse --verify refs/heads/": { reject: true },
      "rev-parse --verify refs/remotes/origin/": { stdout: "", exitCode: 0 },
      "worktree add": { stdout: "" },
    });

    await gitAddWorktree(repoPath, wtPath, branch);

    const calls = mock$.mock.calls.map(c => cmdOf(c));
    const addCall = calls.find(c => c.includes("worktree add"));
    expect(addCall).toBeDefined();
    expect(addCall).toContain(`-b ${branch}`);
    expect(addCall).toContain(`origin/${branch}`);
  });

  it("uses the existing local branch when it exists", async () => {
    shellMock({
      "rev-parse --verify refs/heads/": { stdout: "abc123", exitCode: 0 },
      "worktree add": { stdout: "" },
    });

    await gitAddWorktree(repoPath, wtPath, branch);

    const calls = mock$.mock.calls.map(c => cmdOf(c));
    const addCall = calls.find(c => c.includes("worktree add"));
    expect(addCall).toBeDefined();
    expect(addCall).not.toContain("origin/");
  });
});

describe("pullWorkspace", () => {
  const bareRepo = "/fake/repo.git";
  const workspaceRoot = "/home/user/work";
  const mainWorktree = `${workspaceRoot}/grind`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips archived projects (canceled/published) instead of recreating their worktrees", async () => {
    shellMock({
      "fetch --all": { stdout: "" },
      "branch -r --format": { stdout: "origin/main\norigin/canceled-proj\n" },
      "branch --format": { stdout: "main\n" },
      "rev-parse --verify origin/": { stdout: "abc123", exitCode: 0 },
      "rev-parse --verify refs/heads/": { stdout: "abc123", exitCode: 0 },
      "merge origin/main": { stdout: "" },
      "worktree list --porcelain": { stdout: "worktree /home/user/work/grind\n" },
    });
    (fs.stat as jest.Mock).mockRejectedValue(new Error("ENOENT"));
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ name: "canceled-proj", status: "canceled" }));

    const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

    expect(result.skipped).toBe(1);
    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("worktree add"))).toBe(false);
  });

  it("creates worktrees for active projects with no status", async () => {
    shellMock({
      "fetch --all": { stdout: "" },
      "branch -r --format": { stdout: "origin/main\norigin/active-proj\n" },
      "branch --format": { stdout: "main\n" },
      "rev-parse --verify origin/": { stdout: "abc123", exitCode: 0 },
      "rev-parse --verify refs/heads/": { reject: true },
      "merge origin/main": { stdout: "" },
      "worktree list --porcelain": { stdout: "worktree /home/user/work/grind\n" },
      "worktree add": { stdout: "" },
    });
    (fs.stat as jest.Mock).mockRejectedValue(new Error("ENOENT"));
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ name: "active-proj", time: [] }));

    const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

    expect(result.created).toBe(1);
    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("worktree add") && c.includes("origin/active-proj"))).toBe(true);
  });

  it("fast-forwards a branch checked out in a worktree so its files are refreshed", async () => {
    shellMock({
      "fetch --all": { stdout: "" },
      "branch -r --format": { stdout: "origin/main\norigin/proj\n" },
      "branch --format": { stdout: "main\nproj\n" },
      "rev-parse --verify origin/": { stdout: "new123", exitCode: 0 },
      "rev-parse --verify refs/heads/": { stdout: "old456", exitCode: 0 },
      "merge-base --is-ancestor": { stdout: "", exitCode: 0 },
      "merge --ff-only": { stdout: "" },
      "merge origin/main": { stdout: "" },
      "worktree list --porcelain": { stdout: "worktree /home/user/work/grind\n" },
    });
    (fs.stat as jest.Mock).mockImplementation((p: string) =>
      p === `${workspaceRoot}/proj`
        ? Promise.resolve({} as never)
        : Promise.reject(new Error("ENOENT")),
    );
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ name: "proj", time: [] }));

    const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("merge --ff-only origin/proj"))).toBe(true);
    expect(calls.some(c => c.includes("update-ref refs/heads/proj"))).toBe(false);
    expect(result.updated).toContain("proj");
  });

  it("flags a branch whose worktree blocks fast-forward as diverged instead of desyncing files", async () => {
    shellMock({
      "fetch --all": { stdout: "" },
      "branch -r --format": { stdout: "origin/main\norigin/proj\n" },
      "branch --format": { stdout: "main\nproj\n" },
      "rev-parse --verify origin/": { stdout: "new123", exitCode: 0 },
      "rev-parse --verify refs/heads/": { stdout: "old456", exitCode: 0 },
      "merge-base --is-ancestor": { stdout: "", exitCode: 0 },
      "merge --ff-only": { reject: true },
      "merge origin/main": { stdout: "" },
      "worktree list --porcelain": { stdout: "worktree /home/user/work/grind\n" },
    });
    (fs.stat as jest.Mock).mockImplementation((p: string) =>
      p === `${workspaceRoot}/proj`
        ? Promise.resolve({} as never)
        : Promise.reject(new Error("ENOENT")),
    );
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ name: "proj", time: [] }));

    const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("update-ref refs/heads/proj"))).toBe(false);
    expect(result.updated).not.toContain("proj");
    expect(result.diverged).toContain("proj");
  });

  it("does not treat the symbolic origin/HEAD ref as a project branch", async () => {
    shellMock({
      "fetch --all": { stdout: "" },
      "branch -r --format": { stdout: "origin/HEAD\norigin/main\norigin/proj\n" },
      "branch --format": { stdout: "main\nproj\n" },
      "rev-parse --verify origin/": { stdout: "abc123", exitCode: 0 },
      "rev-parse --verify refs/heads/": { stdout: "abc123", exitCode: 0 },
      "merge origin/main": { stdout: "" },
      "worktree list --porcelain": {
        stdout: "worktree /home/user/work/grind\nworktree /home/user/work/proj\n",
      },
    });
    (fs.stat as jest.Mock).mockRejectedValue(new Error("ENOENT"));
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ name: "proj", time: [] }));

    const result = await pullWorkspace(bareRepo, mainWorktree, workspaceRoot);

    const calls = mock$.mock.calls.map(c => cmdOf(c));
    expect(calls.some(c => c.includes("worktree add"))).toBe(false);
    expect(result.created).toBe(0);
  });
});
