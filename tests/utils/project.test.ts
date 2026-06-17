// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import * as fs from "node:fs/promises";
import { collectProjects } from "../../src/utils/project.ts";

jest.mock("bun");
jest.mock("node:fs/promises");

const mock$ = jest.requireMock("bun").$ as jest.Mock;

describe("collectProjects", () => {
  const workspaceRoot = "/home/user/work";
  const sampleConfig = {
    name: "my-project",
    idea: "A test project",
    time: [],
    billing: { roundTo: "quarter-hour" as const, rate: 150 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({ stdout: Buffer.from("") }),
    }));
  });

  it("returns correct entries from a mocked worktree list", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from(
          `worktree ${workspaceRoot}/my-project\nHEAD abc123...\nbranch refs/heads/my-project\n\nworktree ${workspaceRoot}/grind\nHEAD def456...\nbranch refs/heads/main\n`
        ),
      }),
    }));

    (fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes("my-project") && filePath.endsWith(".project.json")) {
        return Promise.resolve(JSON.stringify(sampleConfig));
      }
      return Promise.reject(new Error("not found"));
    });

    const result = await collectProjects(workspaceRoot);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("my-project");
    expect(result[0].worktreePath).toBe(path.join(workspaceRoot, "my-project"));
    expect(result[0].config).not.toBeNull();
    expect(result[0].config!.name).toBe("my-project");
  });

  it("returns config: null for projects without a config file", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from(
          `worktree ${workspaceRoot}/no-config-project\nHEAD abc123...\nbranch refs/heads/no-config-project\n`
        ),
      }),
    }));

    (fs.readFile as jest.Mock).mockRejectedValue(new Error("not found"));

    const result = await collectProjects(workspaceRoot);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("no-config-project");
    expect(result[0].config).toBeNull();
  });

  it("filters out the main grind worktree", async () => {
    mock$.mockImplementation(() => ({
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from(
          `worktree ${workspaceRoot}/grind\nHEAD def456...\nbranch refs/heads/main\n`
        ),
      }),
    }));

    const result = await collectProjects(workspaceRoot);

    expect(result).toHaveLength(0);
  });
});
