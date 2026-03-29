// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { promoteProject } from "../../src/commands/promote.js";
import * as fs from "node:fs/promises";

jest.mock("node:fs/promises");
jest.mock("bun");
jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockReturnValue({
    workspaceRoot: "/home/user/workspace",
    mainWorktree: "/home/user/workspace/grind",
  }),
}));

jest.mock("../../src/utils/files.js", () => ({
  fileExists: jest.fn().mockImplementation(() => Promise.resolve(true)),
}));

const mock$ = jest.requireMock("bun").$ as jest.Mock;

describe("promoteProject", () => {
  const projectName = "test-project";
  const baseProjectConfig = {
    name: projectName,
    idea: "Test project idea",
    time: [],
    billing: { roundTo: "quarter-hour", rate: 150 },
    publications: [
      { url: "https://example.com/blog/post", publishedAt: "2026-03-29T09:46:01.538Z" },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mock$.mockImplementation(() => ({
      nothrow: jest.fn().mockResolvedValue({
        stdout: Buffer.from(JSON.stringify({ success: true })),
        exitCode: 0,
      }),
    }));
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
  });

  it("should call curl to invoke the n8n webhook", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(baseProjectConfig));

    await promoteProject(projectName);

    expect(mock$).toHaveBeenCalled();
    expect(mock$).toHaveBeenCalledTimes(1);
  });

  it("should exit with error when curl fails", async () => {
    mock$.mockImplementation(() => ({
      nothrow: jest.fn().mockResolvedValue({
        stdout: Buffer.from(""),
        exitCode: 1,
      }),
    }));

    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(baseProjectConfig));

    await promoteProject(projectName);

    expect(console.error).toHaveBeenCalledWith("Error: Could not reach n8n server.");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should exit with error when n8n returns non-ok response", async () => {
    mock$.mockImplementation(() => ({
      nothrow: jest.fn().mockResolvedValue({
        stdout: Buffer.from("error occurred\n500"),
        exitCode: 0,
      }),
    }));

    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(baseProjectConfig));

    await promoteProject(projectName);

    expect(console.error).toHaveBeenCalledWith("Error: n8n webhook failed: error occurred");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
