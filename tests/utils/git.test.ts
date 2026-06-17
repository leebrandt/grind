// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { getDefaultBranch, getFirstCommitDate } from "../../src/utils/git.ts";
import type { GrindConfig } from "../../src/types/index.js";

jest.mock("bun");

const mock$ = jest.requireMock("bun").$ as jest.Mock;

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
